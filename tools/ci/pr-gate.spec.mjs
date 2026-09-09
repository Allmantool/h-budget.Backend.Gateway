import assert from 'node:assert/strict';
import test from 'node:test';

import { REQUIRED_COMMON_JOBS, REQUIRED_PR_JOBS, evaluateGate } from './pr-gate.mjs';

const successfulPr = Object.fromEntries(REQUIRED_PR_JOBS.map(job => [job, { result: 'success' }]));
const successfulCommon = Object.fromEntries(REQUIRED_COMMON_JOBS.map(job => [job, { result: 'success' }]));

test('passes only when PR policy and reusable common quality succeed', () => {
  assert.deepEqual(evaluateGate(successfulPr), { pass: true, blocked: [] });
});

test('common quality passes only when every declared mandatory job succeeds', () => {
  assert.deepEqual(evaluateGate(successfulCommon, REQUIRED_COMMON_JOBS), { pass: true, blocked: [] });
});

for (const [name, mutate, expected] of [
  ['failed PR policy', results => { results['release-policy'] = { result: 'failure' }; }, 'release-policy: failure'],
  ['cancelled reusable common quality', results => { results['common-quality'] = { result: 'cancelled' }; }, 'common-quality: cancelled'],
  ['unexpectedly skipped reusable common quality', results => { results['common-quality'] = { result: 'skipped' }; }, 'common-quality: skipped'],
  ['missing PR policy evidence', results => { delete results['release-policy']; }, 'release-policy: missing'],
]) {
  test(`fails closed for ${name}`, () => {
    const results = structuredClone(successfulPr);
    mutate(results);
    const outcome = evaluateGate(results);
    assert.equal(outcome.pass, false);
    assert.ok(outcome.blocked.includes(expected));
  });
}

for (const [name, mutate, expected] of [
  ['failed test job', results => { results['build-and-test'] = { result: 'failure' }; }, 'build-and-test: failure'],
  ['cancelled required job', results => { results.security = { result: 'cancelled' }; }, 'security: cancelled'],
  ['unexpectedly skipped job', results => { results['workflow-policy'] = { result: 'skipped' }; }, 'workflow-policy: skipped'],
  ['missing required job', results => { delete results['docker-verify']; }, 'docker-verify: missing'],
  ['zero-test suite represented as failed test validation', results => { results['build-and-test'] = { result: 'failure' }; }, 'build-and-test: failure'],
  ['security scanner outage represented as failed security validation', results => { results.security = { result: 'failure' }; }, 'security: failure'],
]) {
  test(`common quality fails closed for ${name}`, () => {
    const results = structuredClone(successfulCommon);
    mutate(results);
    const outcome = evaluateGate(results, REQUIRED_COMMON_JOBS);
    assert.equal(outcome.pass, false);
    assert.ok(outcome.blocked.includes(expected));
  });
}
