import assert from 'node:assert/strict';
import test from 'node:test';

import { findCommittedSecrets } from './config-safety.mjs';
import { evaluateNugetAudit } from './security-policy.mjs';
import { executedTestCount } from './test-execution.mjs';

test('configuration policy allows blank injected values and rejects committed sensitive values without returning them', () => {
  assert.deepEqual(findCommittedSecrets({ SslOptions: { Password: '' }, Jwt: { secret: '   ' } }), []);
  assert.deepEqual(findCommittedSecrets({ SslOptions: { Password: 'not-printed' }, Api: { Token: 'not-printed' } }), [
    'SslOptions.Password',
    'Api.Token',
  ]);
});

test('NuGet audit policy fails closed for a reported finding and passes only an explicit empty result', () => {
  assert.equal(evaluateNugetAudit({ projects: [{ vulnerabilities: [] }] }).pass, true);
  assert.equal(evaluateNugetAudit({ projects: [{ vulnerabilities: [{ severity: 'High' }] }] }).pass, false);
});

test('test execution evidence requires a positive discovered test count', () => {
  assert.equal(executedTestCount('<Counters total="7" />'), 7);
  assert.equal(executedTestCount('<Counters total="0" />'), 0);
  assert.ok(Number.isNaN(executedTestCount('<TestRun />')));
});
