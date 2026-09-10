import { readdir, readFile, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const COVERAGE_METRIC_KEYS = new Set(['coverage', 'new_coverage']);

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

  const nonCoverageFailure = rejected.find(condition => !COVERAGE_METRIC_KEYS.has(condition.metricKey));
  if (nonCoverageFailure) return fail('Sonar rejected mandatory non-coverage conditions.', rejected, gate.ignoredConditions);
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
  if (!projectKey || !ceTaskId || !serverUrl) throw new Error('report-task.txt is missing projectKey, ceTaskId, or serverUrl.');
  if (new URL(serverUrl).origin !== new URL(expectedServerUrl).origin) {
    throw new Error('report-task.txt points to an unexpected Sonar server.');
  }
  return { projectKey, ceTaskId };
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
  if (tasks.length !== 1) throw new Error(`Expected exactly one fresh report-task.txt, found ${tasks.length}.`);
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
    throw new Error('Sonar API request failed.');
  }
  if (!response.ok) throw new Error(`Sonar API request failed with HTTP ${response.status}.`);
  try {
    return await response.json();
  } catch {
    throw new Error('Sonar API returned malformed JSON.');
  }
}

export async function waitForCompletedTask({ serverUrl, ceTaskId, projectKey, token, fetchImpl, sleep, attempts = 30 }) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetchJson(apiUrl(serverUrl, '/api/ce/task', { id: ceTaskId }), token, fetchImpl);
    const task = response?.task;
    if (!task || task.componentKey !== projectKey || typeof task.status !== 'string') {
      throw new Error('Sonar compute-task evidence does not match the scanned project.');
    }
    if (task.status === 'SUCCESS') {
      if (!task.analysisId) throw new Error('Completed Sonar compute task did not provide an analysis ID.');
      return task;
    }
    if (task.status === 'FAILED' || task.status === 'CANCELED') throw new Error(`Sonar compute task ended as ${task.status}.`);
    if (task.status !== 'PENDING' && task.status !== 'IN_PROGRESS') throw new Error('Sonar compute task returned an unexpected status.');
    if (attempt === attempts - 1) break;
    await sleep();
  }
  throw new Error('Timed out waiting for Sonar compute-task processing.');
}

export async function findExactAnalysis({ serverUrl, projectKey, analysisId, revision, pullRequestId, branchName, token, fetchImpl }) {
  if (!pullRequestId && !branchName) throw new Error('Expected Sonar branch or pull-request identity is missing.');
  const identity = pullRequestId ? { pullRequest: pullRequestId } : { branch: branchName };
  let page = 1;
  let pageCount = 1;
  while (page <= pageCount && page <= 10) {
    const response = await fetchJson(apiUrl(serverUrl, '/api/project_analyses/search', {
      project: projectKey, ps: '100', p: String(page), ...identity,
    }), token, fetchImpl);
    if (!Array.isArray(response?.analyses) || !Number.isInteger(response?.paging?.total)) {
      throw new Error('Sonar analysis history evidence is malformed.');
    }
    pageCount = Math.ceil(response.paging.total / 100);
    const matches = response.analyses.filter(analysis => analysis?.key === analysisId);
    if (matches.length > 1) throw new Error('Sonar analysis history contains duplicate analysis IDs.');
    if (matches.length === 1) {
      if (matches[0].revision !== revision) throw new Error('Sonar analysis revision does not match this workflow run.');
      return matches[0];
    }
    page += 1;
  }
  throw new Error('The completed Sonar analysis was not found for this workflow branch or pull request.');
}

export async function evaluateExactAnalysis({ reportTaskFile, serverUrl, projectKey, revision, pullRequestId, branchName, token, fetchImpl = fetch, sleep = () => new Promise(resolveSleep => setTimeout(resolveSleep, 2000)) }) {
  const report = parseReportTask(await readFile(reportTaskFile, 'utf8'), serverUrl);
  if (report.projectKey !== projectKey) throw new Error('report-task.txt project does not match the Gateway project.');
  const task = await waitForCompletedTask({ serverUrl, ceTaskId: report.ceTaskId, projectKey, token, fetchImpl, sleep });
  const analysis = await findExactAnalysis({ serverUrl, projectKey, analysisId: task.analysisId, revision, pullRequestId, branchName, token, fetchImpl });
  const gate = await fetchJson(apiUrl(serverUrl, '/api/qualitygates/project_status', { analysisId: task.analysisId }), token, fetchImpl);
  const decision = evaluateQualityGate(gate);
  return { analysis, task, decision, gate };
}

function sanitizeSummaryValue(value) {
  return String(value ?? 'unavailable').replaceAll(/[\r\n\u001b]/gu, '_').slice(0, 256);
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
  ];
  for (const condition of nonCoverage) lines.push(...formatCondition(condition));
  if (!result.decision.pass && nonCoverage.length === 0) lines.push('Diagnostic: gate evidence was incomplete or contradictory.');
  lines.push(`Coverage: ${rejected.some(condition => COVERAGE_METRIC_KEYS.has(condition.metricKey)) ? 'advisory; not this blocking condition' : 'advisory; no rejected coverage condition'}`);
  return lines;
}

async function writeSummary(lines) {
  const message = lines.map(sanitizeSummaryValue).join('\n');
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
  console.log(message);
}

if (import.meta.main) {
  const serverUrl = 'https://sonarcloud.io';
  const projectKey = 'Allmantool_h-budget-backend-gateway';
  try {
    const reportTaskFile = await locateReportTask();
    const result = await evaluateExactAnalysis({
      reportTaskFile,
      serverUrl,
      projectKey,
      revision: process.env.SONAR_EXPECTED_REVISION ?? '',
      pullRequestId: process.env.PULL_REQUEST_ID ?? '',
      branchName: process.env.GITHUB_REF_NAME ?? '',
      token: process.env.SONAR_TOKEN ?? '',
    });
    await writeSummary(['Analysis processing: SUCCESS', ...formatEvaluation(result, process.env.PULL_REQUEST_ID ?? '', process.env.GITHUB_REF_NAME ?? '')]);
    if (!result.decision.pass) process.exitCode = 1;
  } catch (error) {
    await writeSummary(['Gateway non-coverage policy: FAILED', 'Diagnostic: submitted Sonar evidence could not be safely validated.']);
    process.exitCode = 1;
  }
}
