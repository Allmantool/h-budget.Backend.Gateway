import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { diagnosticCode, evaluateAndReport, evaluateExactAnalysis, evaluateQualityGate, fetchJson, formatEvaluation, locateReportTask, parseReportTask, SONAR_FAILURE_CODES } from './sonar-noncoverage-policy.mjs';

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

async function withReportTask(run, contents = 'projectKey=Allmantool_h-budget-backend-gateway\nceTaskId=task-123\nserverUrl=https://sonarcloud.io\ndashboardUrl=https://sonarcloud.io/dashboard?id=Allmantool_h-budget-backend-gateway&pullRequest=42\n') {
  const directory = await mkdtemp(join(tmpdir(), 'gateway-sonar-policy-'));
  const reportTaskFile = join(directory, 'report-task.txt');
  await writeFile(reportTaskFile, contents);
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
  assert.throws(
    () => parseReportTask('projectKey=Allmantool_h-budget-backend-gateway\nceTaskId=task-123\nserverUrl=https://untrusted.example\n', 'https://sonarcloud.io'),
    error => error.code === SONAR_FAILURE_CODES.ORIGIN_REJECTED,
  );
});

test('does not reject a non-coverage metric whose server status is OK', () => {
  const result = evaluateQualityGate(gate('ERROR', [
    condition('new_coverage', 'ERROR', '0.0'),
    condition('new_reliability_rating', 'OK', '1'),
  ]));
  assert.equal(result.pass, true);
  assert.equal(result.coverageWarning, true);
});

test('rejects and reports every mandatory rating failure alongside advisory coverage', () => {
  const decision = evaluateQualityGate(gate('ERROR', [
    condition('new_coverage', 'ERROR', '0.0'),
    { ...condition('new_reliability_rating', 'ERROR', '3'), comparator: 'GT', errorThreshold: '1' },
    { ...condition('new_maintainability_rating', 'ERROR', '2'), comparator: 'GT', errorThreshold: '1' },
  ]));
  const summary = formatEvaluation({
    analysis: { key: 'analysis-123', revision: 'source-sha' },
    report: { ceTaskId: 'task-123' },
    decision,
  }, '42', '').join('\n');
  assert.equal(decision.pass, false);
  assert.match(summary, /Metric: new\\_reliability\\_rating/);
  assert.match(summary, /Observed: 3 \(C\)/);
  assert.match(summary, /Metric: new\\_maintainability\\_rating/);
  assert.match(summary, /Observed: 2 \(B\)/);
  assert.match(summary, /Coverage: advisory; not this blocking condition/);
});

for (const [name, response, code] of [
  ['API denial', { ok: false, status: 401, json: async () => ({}) }, SONAR_FAILURE_CODES.API_ACCESS_DENIED],
  ['malformed API response', { ok: true, status: 200, json: async () => { throw new Error('bad JSON'); } }, SONAR_FAILURE_CODES.RESPONSE_INVALID],
]) {
  test(`fails closed for ${name}`, async () => {
    await assert.rejects(
      () => fetchJson(new URL('https://sonarcloud.io/api/ce/task?id=task-123'), 'fixture-token', async () => response),
      error => error.code === code,
    );
  });
}

function successfulFetch({ taskStatuses = ['SUCCESS'], gateResponse = gate('ERROR', [condition('new_coverage', 'ERROR', '0.0')]), revision = 'candidate-sha', taskProject = 'Allmantool_h-budget-backend-gateway', pullRequestId, sourceBranch = 'feature/source', targetBranch = 'master' } = {}) {
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
      assert.equal(request.searchParams.get('branch'), 'master');
      return jsonResponse({
        paging: { total: 2 },
        analyses: [
          { key: 'unrelated-newer-analysis', revision: 'other-sha' },
          { key: 'analysis-123', revision },
        ],
      });
    }
    if (request.pathname === '/api/project_pull_requests/list') {
      assert.equal(request.searchParams.get('project'), 'Allmantool_h-budget-backend-gateway');
      return jsonResponse({ pullRequests: [{ key: pullRequestId, branch: sourceBranch, base: targetBranch, commit: { sha: revision } }] });
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

test('accepts a selected PR source SHA even when it differs from the merge candidate', async () => {
  await withReportTask(async reportTaskFile => {
    const result = await evaluateExactAnalysis({
      reportTaskFile,
      serverUrl: 'https://sonarcloud.io',
      projectKey: 'Allmantool_h-budget-backend-gateway',
      revision: 'source-sha',
      pullRequestId: '42',
      sourceBranch: 'feature/source',
      targetBranch: 'master',
      token: 'fixture-token',
      fetchImpl: successfulFetch({ pullRequestId: '42', revision: 'source-sha' }),
      sleep: async () => {},
    });
    assert.equal(result.analysis.key, 'analysis-123');
  });
});

test('preserves a security rejection and reports actionable sanitized condition details', async () => {
  await withReportTask(async reportTaskFile => {
    const result = await evaluateExactAnalysis({
      reportTaskFile,
      serverUrl: 'https://sonarcloud.io',
      projectKey: 'Allmantool_h-budget-backend-gateway',
      revision: 'candidate-sha',
      branchName: 'master',
      token: 'fixture-token',
      fetchImpl: successfulFetch({
        gateResponse: gate('ERROR', [
          condition('new_coverage', 'ERROR', '0.0'),
          { ...condition('new_security_rating', 'ERROR', '2'), comparator: 'GT', errorThreshold: '1' },
        ]),
      }),
      sleep: async () => {},
    });
    assert.equal(result.decision.pass, false);
    assert.equal(result.decision.rejected.length, 2);
    const summary = formatEvaluation(result, '', 'master').join('\n');
    assert.match(summary, /Analysis: analysis-123, revision candidate-sha, branch master/);
    assert.match(summary, /Metric: new\\_security\\_rating/);
    assert.match(summary, /Status: ERROR/);
    assert.match(summary, /Observed: 2 \(B\)/);
    assert.match(summary, /Required: > 1/);
    assert.match(summary, /Coverage: advisory; not this blocking condition/);
  });
});

test('sanitizes control characters from remote diagnostic values', () => {
  const lines = formatEvaluation({
    analysis: { key: 'analysis-123\nforged', revision: 'candidate-sha\rforged' },
    report: { ceTaskId: `task-${String.fromCodePoint(27)}forged` },
    decision: {
      pass: false,
      rejected: [{ metricKey: 'new_security_rating\n[forged](https://untrusted.example)', status: 'ERROR\rforged', actualValue: '2', comparator: 'GT', errorThreshold: '1\nforged' }],
    },
  }, '', 'master\nforged');
  assert.equal(lines.some(line => /[\r\n]/u.test(line)), false);
  assert.match(lines.join(' '), /forged/);
  assert.doesNotMatch(lines.join(' '), /\[forged\]\(/u);
});

test('reports evaluator exceptions with a safe code and preserves failure', async () => {
  const writes = [];
  const pass = await evaluateAndReport(
    async () => { throw new Error('untrusted\nremote detail'); },
    async lines => { writes.push(lines); },
    '42',
    '',
  );
  assert.equal(pass, false);
  assert.deepEqual(writes, [['Gateway non-coverage policy: FAILED', `Diagnostic: ${SONAR_FAILURE_CODES.EVALUATOR_FAILURE}`]]);
  assert.equal(diagnosticCode({ code: 'not-a-sonar-code' }), SONAR_FAILURE_CODES.EVALUATOR_FAILURE);
});

for (const [name, options, code] of [
  ['failed compute task', { taskStatuses: ['FAILED'] }, SONAR_FAILURE_CODES.TASK_FAILED],
  ['cancelled compute task', { taskStatuses: ['CANCELED'] }, SONAR_FAILURE_CODES.TASK_CANCELLED],
  ['wrong compute-task project', { taskProject: 'another-project' }, SONAR_FAILURE_CODES.PROJECT_MISMATCH],
  ['stale analysis revision', { revision: 'stale-sha' }, SONAR_FAILURE_CODES.REVISION_MISMATCH],
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
      }), error => error.code === code);
    });
  });
}

test('returns a failed decision for a non-coverage rejection', async () => {
  await withReportTask(async reportTaskFile => {
    const result = await evaluateExactAnalysis({
      reportTaskFile,
      serverUrl: 'https://sonarcloud.io',
      projectKey: 'Allmantool_h-budget-backend-gateway',
      revision: 'candidate-sha',
      branchName: 'master',
      token: 'fixture-token',
      fetchImpl: successfulFetch({ gateResponse: gate('ERROR', [condition('new_reliability_rating', 'ERROR')]) }),
      sleep: async () => {},
    });
    assert.equal(result.decision.pass, false);
    assert.equal(result.decision.reason, SONAR_FAILURE_CODES.NONCOVERAGE_REJECTED);
  });
});

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
    }), error => error.code === SONAR_FAILURE_CODES.TASK_TIMEOUT);
  });
});

test('rejects a PR record with a newer source revision', async () => {
  await withReportTask(async reportTaskFile => {
    await assert.rejects(() => evaluateExactAnalysis({
      reportTaskFile,
      serverUrl: 'https://sonarcloud.io',
      projectKey: 'Allmantool_h-budget-backend-gateway',
      revision: 'selected-source-sha',
      pullRequestId: '42',
      sourceBranch: 'feature/source',
      targetBranch: 'master',
      token: 'fixture-token',
      fetchImpl: successfulFetch({ pullRequestId: '42', revision: 'newer-source-sha' }),
      sleep: async () => {},
    }), error => error.code === SONAR_FAILURE_CODES.REVISION_MISMATCH);
  });
});

test('rejects evidence for a different pull request', async () => {
  await withReportTask(async reportTaskFile => {
    await assert.rejects(() => evaluateExactAnalysis({
      reportTaskFile,
      serverUrl: 'https://sonarcloud.io',
      projectKey: 'Allmantool_h-budget-backend-gateway',
      revision: 'selected-source-sha',
      pullRequestId: '42',
      sourceBranch: 'feature/source',
      targetBranch: 'master',
      token: 'fixture-token',
      fetchImpl: successfulFetch({ pullRequestId: '41', revision: 'selected-source-sha' }),
      sleep: async () => {},
    }), error => error.code === SONAR_FAILURE_CODES.PULL_REQUEST_MISMATCH);
  });
});

test('rejects missing PR scanner metadata before trusting task evidence', async () => {
  await withReportTask(async reportTaskFile => {
    await assert.rejects(() => evaluateExactAnalysis({
      reportTaskFile,
      serverUrl: 'https://sonarcloud.io',
      projectKey: 'Allmantool_h-budget-backend-gateway',
      revision: 'selected-source-sha',
      pullRequestId: '42',
      sourceBranch: 'feature/source',
      targetBranch: 'master',
      token: 'fixture-token',
      fetchImpl: successfulFetch({ pullRequestId: '42', revision: 'selected-source-sha' }),
      sleep: async () => {},
    }), error => error.code === SONAR_FAILURE_CODES.REPORT_TASK_INVALID);
  }, 'projectKey=Allmantool_h-budget-backend-gateway\nceTaskId=task-123\nserverUrl=https://sonarcloud.io\n');
});
