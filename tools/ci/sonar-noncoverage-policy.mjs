import { readdir, readFile, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const COVERAGE_METRIC_KEYS = new Set(['coverage', 'new_coverage']);

export const SONAR_FAILURE_CODES = Object.freeze({
  API_ACCESS_DENIED: 'SONAR_API_ACCESS_DENIED',
  API_REQUEST_FAILED: 'SONAR_API_REQUEST_FAILED',
  ANALYSIS_NOT_FOUND: 'SONAR_ANALYSIS_NOT_FOUND',
  EVALUATOR_FAILURE: 'SONAR_EVALUATOR_FAILURE',
  NONCOVERAGE_REJECTED: 'SONAR_NONCOVERAGE_REJECTED',
  ORIGIN_REJECTED: 'SONAR_ORIGIN_REJECTED',
  PROJECT_MISMATCH: 'SONAR_PROJECT_MISMATCH',
  PULL_REQUEST_MISMATCH: 'SONAR_PULL_REQUEST_MISMATCH',
  REPORT_TASK_INVALID: 'SONAR_REPORT_TASK_INVALID',
  RESPONSE_INVALID: 'SONAR_RESPONSE_INVALID',
  REVISION_MISMATCH: 'SONAR_REVISION_MISMATCH',
  TASK_CANCELLED: 'SONAR_TASK_CANCELLED',
  TASK_FAILED: 'SONAR_TASK_FAILED',
  TASK_TIMEOUT: 'SONAR_TASK_TIMEOUT',
});

function evidenceFailure(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function fail(reason, rejected = [], ignoredConditions = false) {
  return { pass: false, reason, rejected, ignoredConditions };
}

export function evaluateQualityGate(response) {
  const gate = response?.projectStatus;
  if (!gate || !Array.isArray(gate.conditions) || typeof gate.ignoredConditions !== 'boolean') {
    return fail('Sonar returned malformed or incomplete quality-gate evidence.');
  }

  const rejected = [];
  for (const condition of gate.conditions) {
    if (!condition || typeof condition.metricKey !== 'string') {
      return fail('Sonar returned a condition without a metric key.');
    }
    if (condition.status === 'OK') continue;
    if (condition.status === 'ERROR') {
      rejected.push(condition);
      continue;
    }
    if (condition.status === 'NO_VALUE' && condition.actualValue === undefined) continue;
    return fail('Sonar returned an unsupported condition status.', rejected, gate.ignoredConditions);
  }

  if (gate.status === 'OK') {
    return rejected.length === 0
      ? { pass: true, coverageWarning: false, ignoredConditions: gate.ignoredConditions, rejected: [] }
      : fail('Sonar reported an OK gate with rejected condition evidence.');
  }
  if (gate.status !== 'ERROR') return fail('Sonar returned an unexpected quality-gate status.', rejected, gate.ignoredConditions);
  if (rejected.length === 0) return fail('Sonar reported an ERROR gate without rejected condition evidence.', rejected, gate.ignoredConditions);

  const hasNonCoverageFailure = rejected.some(condition => !COVERAGE_METRIC_KEYS.has(condition.metricKey));
  if (hasNonCoverageFailure) return fail(SONAR_FAILURE_CODES.NONCOVERAGE_REJECTED, rejected, gate.ignoredConditions);
  return { pass: true, coverageWarning: true, ignoredConditions: gate.ignoredConditions, rejected };
}

export function parseReportTask(contents, expectedServerUrl) {
  const values = new Map();
  for (const line of contents.split(/\r?\n/)) {
    const separator = line.indexOf('=');
    if (separator > 0) values.set(line.slice(0, separator), line.slice(separator + 1));
  }
  const projectKey = values.get('projectKey');
  const ceTaskId = values.get('ceTaskId');
  const serverUrl = values.get('serverUrl');
  const dashboardUrl = values.get('dashboardUrl');
  if (!projectKey || !ceTaskId || !serverUrl) throw evidenceFailure(SONAR_FAILURE_CODES.REPORT_TASK_INVALID);
  try {
    if (new URL(serverUrl).origin !== new URL(expectedServerUrl).origin) throw evidenceFailure(SONAR_FAILURE_CODES.ORIGIN_REJECTED);
  } catch (error) {
    if (error.code) throw error;
    throw evidenceFailure(SONAR_FAILURE_CODES.REPORT_TASK_INVALID);
  }
  return { projectKey, ceTaskId, dashboardUrl };
}

function validatePullRequestReport(report, serverUrl, projectKey, pullRequestId) {
  if (!report.dashboardUrl) throw evidenceFailure(SONAR_FAILURE_CODES.REPORT_TASK_INVALID);
  try {
    const dashboardUrl = new URL(report.dashboardUrl);
    if (dashboardUrl.origin !== new URL(serverUrl).origin) throw evidenceFailure(SONAR_FAILURE_CODES.ORIGIN_REJECTED);
    if (dashboardUrl.searchParams.get('id') !== projectKey || dashboardUrl.searchParams.get('pullRequest') !== pullRequestId) {
      throw evidenceFailure(SONAR_FAILURE_CODES.PULL_REQUEST_MISMATCH);
    }
  } catch (error) {
    if (error.code) throw error;
    throw evidenceFailure(SONAR_FAILURE_CODES.REPORT_TASK_INVALID);
  }
}

async function findReportTasks(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const matches = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) matches.push(...await findReportTasks(path));
    if (entry.isFile() && entry.name === 'report-task.txt') matches.push(path);
  }
  return matches;
}

export async function locateReportTask(root = process.cwd()) {
  const tasks = await findReportTasks(resolve(root, '.sonarqube'));
  if (tasks.length !== 1) throw evidenceFailure(SONAR_FAILURE_CODES.REPORT_TASK_INVALID);
  return tasks[0];
}

function apiUrl(serverUrl, path, parameters) {
  const url = new URL(path, serverUrl);
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  return url;
}

function authorize(token) {
  return `Bearer ${token}`;
}

export async function fetchJson(url, token, fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl(url, { headers: { Authorization: authorize(token) }, redirect: 'error' });
  } catch {
    throw evidenceFailure(SONAR_FAILURE_CODES.API_REQUEST_FAILED);
  }
  if (!response.ok) {
    const code = response.status === 401 || response.status === 403
      ? SONAR_FAILURE_CODES.API_ACCESS_DENIED
      : SONAR_FAILURE_CODES.API_REQUEST_FAILED;
    throw evidenceFailure(code);
  }
  try {
    return await response.json();
  } catch {
    throw evidenceFailure(SONAR_FAILURE_CODES.RESPONSE_INVALID);
  }
}

export async function waitForCompletedTask({ serverUrl, ceTaskId, projectKey, token, fetchImpl, sleep, attempts = 30 }) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetchJson(apiUrl(serverUrl, '/api/ce/task', { id: ceTaskId }), token, fetchImpl);
    const task = response?.task;
    if (!task || task.componentKey !== projectKey || typeof task.status !== 'string') {
      throw evidenceFailure(SONAR_FAILURE_CODES.PROJECT_MISMATCH);
    }
    if (task.status === 'SUCCESS') {
      if (!task.analysisId) throw evidenceFailure(SONAR_FAILURE_CODES.RESPONSE_INVALID);
      return task;
    }
    if (task.status === 'FAILED') throw evidenceFailure(SONAR_FAILURE_CODES.TASK_FAILED);
    if (task.status === 'CANCELED') throw evidenceFailure(SONAR_FAILURE_CODES.TASK_CANCELLED);
    if (task.status !== 'PENDING' && task.status !== 'IN_PROGRESS') throw evidenceFailure(SONAR_FAILURE_CODES.RESPONSE_INVALID);
    if (attempt === attempts - 1) break;
    await sleep();
  }
  throw evidenceFailure(SONAR_FAILURE_CODES.TASK_TIMEOUT);
}

export async function findExactBranchAnalysis({ serverUrl, projectKey, analysisId, revision, branchName, token, fetchImpl }) {
  if (!branchName) throw evidenceFailure(SONAR_FAILURE_CODES.RESPONSE_INVALID);
  let page = 1;
  let pageCount = 1;
  while (page <= pageCount && page <= 10) {
    const response = await fetchJson(apiUrl(serverUrl, '/api/project_analyses/search', {
      project: projectKey, ps: '100', p: String(page), branch: branchName,
    }), token, fetchImpl);
    if (!Array.isArray(response?.analyses) || !Number.isInteger(response?.paging?.total)) {
      throw evidenceFailure(SONAR_FAILURE_CODES.RESPONSE_INVALID);
    }
    pageCount = Math.ceil(response.paging.total / 100);
    const matches = response.analyses.filter(analysis => analysis?.key === analysisId);
    if (matches.length > 1) throw evidenceFailure(SONAR_FAILURE_CODES.RESPONSE_INVALID);
    if (matches.length === 1) {
      if (matches[0].revision !== revision) throw evidenceFailure(SONAR_FAILURE_CODES.REVISION_MISMATCH);
      return matches[0];
    }
    page += 1;
  }
  throw evidenceFailure(SONAR_FAILURE_CODES.ANALYSIS_NOT_FOUND);
}

export async function findExactPullRequest({ serverUrl, projectKey, revision, pullRequestId, sourceBranch, targetBranch, token, fetchImpl }) {
  const response = await fetchJson(apiUrl(serverUrl, '/api/project_pull_requests/list', { project: projectKey }), token, fetchImpl);
  if (!Array.isArray(response?.pullRequests)) throw evidenceFailure(SONAR_FAILURE_CODES.RESPONSE_INVALID);
  const pullRequest = response.pullRequests.find(candidate => candidate?.key === pullRequestId);
  if (!pullRequest || pullRequest.branch !== sourceBranch || pullRequest.base !== targetBranch) {
    throw evidenceFailure(SONAR_FAILURE_CODES.PULL_REQUEST_MISMATCH);
  }
  if (pullRequest?.commit?.sha !== revision) throw evidenceFailure(SONAR_FAILURE_CODES.REVISION_MISMATCH);
  return pullRequest;
}

export async function evaluateExactAnalysis({ reportTaskFile, serverUrl, projectKey, revision, pullRequestId, sourceBranch, targetBranch, branchName, token, fetchImpl = fetch, sleep = () => new Promise(resolveSleep => setTimeout(resolveSleep, 2000)) }) {
  const report = parseReportTask(await readFile(reportTaskFile, 'utf8'), serverUrl);
  if (report.projectKey !== projectKey) throw evidenceFailure(SONAR_FAILURE_CODES.PROJECT_MISMATCH);
  if (pullRequestId) validatePullRequestReport(report, serverUrl, projectKey, pullRequestId);
  const task = await waitForCompletedTask({ serverUrl, ceTaskId: report.ceTaskId, projectKey, token, fetchImpl, sleep });
  const analysis = pullRequestId
    ? { key: task.analysisId, revision, pullRequest: await findExactPullRequest({ serverUrl, projectKey, revision, pullRequestId, sourceBranch, targetBranch, token, fetchImpl }) }
    : await findExactBranchAnalysis({ serverUrl, projectKey, analysisId: task.analysisId, revision, branchName, token, fetchImpl });
  const gate = await fetchJson(apiUrl(serverUrl, '/api/qualitygates/project_status', { analysisId: task.analysisId }), token, fetchImpl);
  const decision = evaluateQualityGate(gate);
  return { analysis, report, task, decision, gate };
}

function sanitizeSummaryValue(value) {
  return String(value ?? 'unavailable')
    .replaceAll(/[\r\n]/gu, '_')
    .replaceAll(String.fromCodePoint(27), '_')
    .replaceAll(/[`\\*_{}\[\]()<>#+!|]/gu, '\\$&')
    .slice(0, 256);
}

function humanReadableValue(condition) {
  if (!condition.metricKey.endsWith('_rating')) return sanitizeSummaryValue(condition.actualValue);
  return { 1: '1 (A)', 2: '2 (B)', 3: '3 (C)', 4: '4 (D)', 5: '5 (E)' }[condition.actualValue] ?? 'unrecognized rating';
}

function formatCondition(condition) {
  const comparator = { GT: '>', LT: '<', GTE: '>=', LTE: '<=', EQ: '=' }[condition.comparator] ?? 'unrecognized comparator';
  return [
    `Metric: ${sanitizeSummaryValue(condition.metricKey)}`,
    `Status: ${sanitizeSummaryValue(condition.status)}`,
    `Observed: ${humanReadableValue(condition)}`,
    `Required: ${comparator} ${sanitizeSummaryValue(condition.errorThreshold)}`,
  ];
}

export function formatEvaluation(result, pullRequestId, branchName) {
  const rejected = result.decision.rejected ?? [];
  const nonCoverage = rejected.filter(condition => !COVERAGE_METRIC_KEYS.has(condition.metricKey));
  const identity = pullRequestId ? `PR ${pullRequestId}` : `branch ${branchName}`;
  const lines = [
    `Gateway non-coverage policy: ${result.decision.pass ? 'PASSED' : 'FAILED'}`,
    `Analysis: ${sanitizeSummaryValue(result.analysis.key)}, revision ${sanitizeSummaryValue(result.analysis.revision)}, ${sanitizeSummaryValue(identity)}`,
    `Compute task: ${sanitizeSummaryValue(result.report.ceTaskId)}`,
  ];
  for (const condition of nonCoverage) lines.push(...formatCondition(condition));
  if (!result.decision.pass && nonCoverage.length === 0) lines.push('Diagnostic: gate evidence was incomplete or contradictory.');
  lines.push(`Coverage: ${rejected.some(condition => COVERAGE_METRIC_KEYS.has(condition.metricKey)) ? 'advisory; not this blocking condition' : 'advisory; no rejected coverage condition'}`);
  return lines;
}

export function diagnosticCode(error) {
  return Object.values(SONAR_FAILURE_CODES).includes(error?.code)
    ? error.code
    : SONAR_FAILURE_CODES.EVALUATOR_FAILURE;
}

async function writeSummary(lines) {
  const message = lines.map(sanitizeSummaryValue).join('\n');
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
  console.log(message);
}

export async function evaluateAndReport(evaluate, write, pullRequestId, branchName) {
  try {
    const result = await evaluate();
    await write(['Analysis processing: SUCCESS', ...formatEvaluation(result, pullRequestId, branchName)]);
    return result.decision.pass;
  } catch (error) {
    await write(['Gateway non-coverage policy: FAILED', `Diagnostic: ${diagnosticCode(error)}`]);
    return false;
  }
}

if (import.meta.main) {
  const serverUrl = 'https://sonarcloud.io';
  const projectKey = 'Allmantool_h-budget-backend-gateway';
  const pass = await evaluateAndReport(async () => {
    const reportTaskFile = await locateReportTask();
    return evaluateExactAnalysis({
      reportTaskFile,
      serverUrl,
      projectKey,
      revision: process.env.SONAR_EXPECTED_REVISION ?? '',
      pullRequestId: process.env.PULL_REQUEST_ID ?? '',
      sourceBranch: process.env.PULL_REQUEST_SOURCE_BRANCH ?? '',
      targetBranch: process.env.PULL_REQUEST_TARGET_BRANCH ?? '',
      branchName: process.env.GITHUB_REF_NAME ?? '',
      token: process.env.SONAR_TOKEN ?? '',
    });
  }, writeSummary, process.env.PULL_REQUEST_ID ?? '', process.env.GITHUB_REF_NAME ?? '');
  if (!pass) process.exitCode = 1;
}
