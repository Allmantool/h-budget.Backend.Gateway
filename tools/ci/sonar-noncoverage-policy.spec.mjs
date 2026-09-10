import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { evaluateExactAnalysis, evaluateQualityGate, fetchJson, locateReportTask, parseReportTask } from './sonar-noncoverage-policy.mjs';

function gate(status, conditions, ignoredConditions = false) {
  return { projectStatus: { status, conditions, ignoredConditions } };
}

function condition(metricKey, status, actualValue = '1') {
  return { metricKey, status, actualValue };
}

test('accepts only confirmed coverage-only rejections as advisory', () => {
  const result = evaluateQualityGate(gate('ERROR', [condition('new_coverage', 'ERROR', '0.0')]));
  assert.deepEqual(result.coverageWarning, true);
  assert.deepEqual(result.pass, true);
});

for (const [name, response] of [
  ['coverage plus security rejection', gate('ERROR', [condition('new_coverage', 'ERROR'), condition('new_security_rating', 'ERROR')])],
  ['coverage plus duplication rejection', gate('ERROR', [condition('new_coverage', 'ERROR'), condition('new_duplicated_lines_density', 'ERROR')])],
  ['rejected security-hotspot review', gate('ERROR', [condition('new_security_hotspots_reviewed', 'ERROR')])],
  ['unknown rejected metric', gate('ERROR', [condition('new_unfamiliar_metric', 'ERROR')])],
  ['error without rejected condition evidence', gate('ERROR', [])],
  ['contradictory OK gate', gate('OK', [condition('new_coverage', 'ERROR')])],
  ['malformed condition evidence', { projectStatus: { status: 'OK', conditions: [] } }],
]) {
  test(`fails closed for ${name}`, () => {
    assert.equal(evaluateQualityGate(response).pass, false);
  });
}

test('accepts a valid all-OK response and documented no-value condition', () => {
  const noValue = { metricKey: 'new_coverage', status: 'NO_VALUE' };
  const result = evaluateQualityGate(gate('OK', [condition('new_security_rating', 'OK'), noValue], true));
  assert.equal(result.pass, true);
  assert.equal(result.coverageWarning, false);
  assert.equal(result.ignoredConditions, true);
});

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

async function withReportTask(run) {
  const directory = await mkdtemp(join(tmpdir(), 'gateway-sonar-policy-'));
  const reportTaskFile = join(directory, 'report-task.txt');
  await writeFile(reportTaskFile, 'projectKey=Allmantool_h-budget-backend-gateway\nceTaskId=task-123\nserverUrl=https://sonarcloud.io\n');
  try {
    return await run(reportTaskFile);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('locates exactly one scanner report-task file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'gateway-sonar-report-'));
  const reportDirectory = join(directory, '.sonarqube', 'out', '.sonar');
  await mkdir(reportDirectory, { recursive: true });
  const expected = join(reportDirectory, 'report-task.txt');
  await writeFile(expected, 'fixture');
  try {
    assert.equal(await locateReportTask(directory), expected);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects unexpected report-task server metadata before API access', () => {
  assert.throws(() => parseReportTask('projectKey=Allmantool_h-budget-backend-gateway\nceTaskId=task-123\nserverUrl=https://untrusted.example\n', 'https://sonarcloud.io'), /unexpected Sonar server/);
});

for (const [name, response] of [
  ['API denial', { ok: false, status: 401, json: async () => ({}) }],
  ['malformed API response', { ok: true, status: 200, json: async () => { throw new Error('bad JSON'); } }],
]) {
  test(`fails closed for ${name}`, async () => {
    await assert.rejects(() => fetchJson(new URL('https://sonarcloud.io/api/ce/task?id=task-123'), 'fixture-token', async () => response));
  });
}

function successfulFetch({ taskStatuses = ['SUCCESS'], gateResponse = gate('ERROR', [condition('new_coverage', 'ERROR', '0.0')]), revision = 'candidate-sha', taskProject = 'Allmantool_h-budget-backend-gateway', pullRequestId } = {}) {
  let taskCall = 0;
  return async url => {
    const request = new URL(url);
    if (request.pathname === '/api/ce/task') {
      const status = taskStatuses[Math.min(taskCall, taskStatuses.length - 1)];
      taskCall += 1;
      return jsonResponse({ task: { status, componentKey: taskProject, analysisId: status === 'SUCCESS' ? 'analysis-123' : undefined } });
    }
    if (request.pathname === '/api/project_analyses/search') {
      assert.equal(request.searchParams.get('project'), 'Allmantool_h-budget-backend-gateway');
      if (pullRequestId) assert.equal(request.searchParams.get('pullRequest'), pullRequestId);
      else assert.equal(request.searchParams.get('branch'), 'master');
      return jsonResponse({
        paging: { total: 2 },
        analyses: [
          { key: 'unrelated-newer-analysis', revision: 'other-sha' },
          { key: 'analysis-123', revision },
        ],
      });
    }
    if (request.pathname === '/api/qualitygates/project_status') {
      assert.equal(request.searchParams.get('analysisId'), 'analysis-123');
      return jsonResponse(gateResponse);
    }
    throw new Error(`Unexpected request ${request.pathname}`);
  };
}

test('waits for the submitted task and evaluates its exact analysis rather than the latest analysis', async () => {
  await withReportTask(async reportTaskFile => {
    const result = await evaluateExactAnalysis({
      reportTaskFile,
      serverUrl: 'https://sonarcloud.io',
      projectKey: 'Allmantool_h-budget-backend-gateway',
      revision: 'candidate-sha',
      branchName: 'master',
      token: 'fixture-token',
      fetchImpl: successfulFetch({ taskStatuses: ['PENDING', 'IN_PROGRESS', 'SUCCESS'] }),
      sleep: async () => {},
    });
    assert.equal(result.analysis.key, 'analysis-123');
    assert.equal(result.decision.coverageWarning, true);
  });
});

test('uses the submitted pull-request identity when correlating an analysis', async () => {
  await withReportTask(async reportTaskFile => {
    const result = await evaluateExactAnalysis({
      reportTaskFile,
      serverUrl: 'https://sonarcloud.io',
      projectKey: 'Allmantool_h-budget-backend-gateway',
      revision: 'candidate-sha',
      pullRequestId: '42',
      token: 'fixture-token',
      fetchImpl: successfulFetch({ pullRequestId: '42' }),
      sleep: async () => {},
    });
    assert.equal(result.analysis.key, 'analysis-123');
  });
});

for (const [name, options, expected] of [
  ['failed compute task', { taskStatuses: ['FAILED'] }, /ended as FAILED/],
  ['cancelled compute task', { taskStatuses: ['CANCELED'] }, /ended as CANCELED/],
  ['wrong compute-task project', { taskProject: 'another-project' }, /does not match the scanned project/],
  ['stale analysis revision', { revision: 'stale-sha' }, /revision does not match/],
  ['non-coverage gate rejection', { gateResponse: gate('ERROR', [condition('new_reliability_rating', 'ERROR')]) }, /mandatory non-coverage metric/],
]) {
  test(`fails closed for ${name}`, async () => {
    await withReportTask(async reportTaskFile => {
      await assert.rejects(() => evaluateExactAnalysis({
        reportTaskFile,
        serverUrl: 'https://sonarcloud.io',
        projectKey: 'Allmantool_h-budget-backend-gateway',
        revision: 'candidate-sha',
        branchName: 'master',
        token: 'fixture-token',
        fetchImpl: successfulFetch(options),
        sleep: async () => {},
      }), expected);
    });
  });
}

test('fails after a finite pending-task timeout', async () => {
  await withReportTask(async reportTaskFile => {
    await assert.rejects(() => evaluateExactAnalysis({
      reportTaskFile,
      serverUrl: 'https://sonarcloud.io',
      projectKey: 'Allmantool_h-budget-backend-gateway',
      revision: 'candidate-sha',
      branchName: 'master',
      token: 'fixture-token',
      fetchImpl: successfulFetch({ taskStatuses: ['PENDING'] }),
      sleep: async () => {},
    }), /Timed out/);
  });
});
