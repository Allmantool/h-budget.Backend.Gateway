import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateDelivery } from './delivery-result.mjs';
import { resolveReleaseDecision } from './release-decision.mjs';

test('uses semantic-release observer data without independently calculating a version', () => {
  const decision = resolveReleaseDecision({
    sourceSha: 'source-sha',
    previousRelease: { version: '0.0.796' },
    nextRelease: { version: '0.1.0', gitTag: 'v0.1.0', gitHead: 'source-sha', type: 'minor' },
  });
  assert.deepEqual(decision, {
    decision: 'RELEASED',
    reason: 'semantic-release created the immutable release identity.',
    version: '0.1.0',
    gitTag: 'v0.1.0',
    sourceSha: 'source-sha',
    previousVersion: '0.0.796',
    releaseType: 'minor',
  });
});

test('reports no-release and draft recovery without allocating another version', () => {
  assert.equal(resolveReleaseDecision({ previousRelease: { version: '0.0.796' } }).decision, 'NO_RELEASE');
  const recovery = resolveReleaseDecision({ previousRelease: { version: '0.0.796' } }, { tag: 'v0.1.0', sourceSha: 'source-sha' });
  assert.equal(recovery.decision, 'RECOVERY');
  assert.equal(recovery.version, '0.1.0');
});

test('final delivery status cannot pass for missing or failed publication evidence', () => {
  assert.equal(evaluateDelivery({ verifyResult: 'failure' }).finalOutcome, 'FAILED');
  assert.equal(evaluateDelivery({ verifyResult: 'success', publishResult: 'success' }).finalOutcome, 'NO_RELEASE');
  assert.equal(evaluateDelivery({ verifyResult: 'success', publishResult: 'failure', gitTag: 'v0.1.0' }).finalOutcome, 'FAILED');
  assert.equal(evaluateDelivery({ verifyResult: 'success', publishResult: 'success', gitTag: 'v0.1.0', deliveryResult: 'failure' }).finalOutcome, 'FAILED');
  assert.equal(evaluateDelivery({ verifyResult: 'success', publishResult: 'success', gitTag: 'v0.1.0', deliveryResult: 'success' }).finalOutcome, 'PUBLISHED');
});
