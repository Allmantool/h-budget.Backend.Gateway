import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateDelivery } from './delivery-result.mjs';
import { resolveReleaseDecision } from './release-decision.mjs';
import { githubReleaseId } from './release-observer.mjs';
import { resolveExactRelease, validateReleaseIdentity } from './release-resolver.mjs';

test('uses semantic-release observer data without independently calculating a version', () => {
  const decision = resolveReleaseDecision({
    sourceSha: 'source-sha',
    releaseId: 385437440,
    previousRelease: { version: '0.0.796' },
    nextRelease: { version: '0.1.0', gitTag: 'v0.1.0', gitHead: 'source-sha', type: 'minor' },
  });
  assert.deepEqual(decision, {
    decision: 'RELEASED',
    reason: 'semantic-release created the immutable release identity.',
    version: '0.1.0',
    gitTag: 'v0.1.0',
    sourceSha: 'source-sha',
    releaseId: 385437440,
    previousVersion: '0.0.796',
    releaseType: 'minor',
  });
});

test('reports no-release and draft recovery without allocating another version', () => {
  assert.equal(resolveReleaseDecision({ previousRelease: { version: '0.0.796' } }).decision, 'NO_RELEASE');
  const recovery = resolveReleaseDecision({ previousRelease: { version: '0.0.796' } }, { tag: 'v0.1.0', sourceSha: 'source-sha', releaseId: 385437440 });
  assert.equal(recovery.decision, 'RECOVERY');
  assert.equal(recovery.version, '0.1.0');
  assert.equal(recovery.releaseId, 385437440);
});

test('records the numeric REST ID returned by the locked GitHub publish plugin', () => {
  assert.equal(githubReleaseId([{ name: 'GitHub release', id: 385437440 }]), 385437440);
  assert.throws(() => githubReleaseId([]), /numeric GitHub Release ID/);
  assert.throws(() => githubReleaseId([{ name: 'GitHub release', id: 'node-id' }]), /numeric GitHub Release ID/);
});

test('resolves an accessible draft by exact tag instead of a published-only tag endpoint', () => {
  const release = resolveExactRelease([
    { id: 385437440, tag_name: 'v0.1.0', draft: true },
    { id: 99, tag_name: 'v0.0.796', draft: false },
  ], 'v0.1.0');
  assert.deepEqual(release, { releaseId: 385437440, tag: 'v0.1.0', draft: true });
});

test('fails closed for missing, ambiguous, or non-numeric recovered release identities', () => {
  assert.throws(() => resolveExactRelease([], 'v0.1.0'), /exactly one/);
  assert.throws(() => resolveExactRelease([{ id: 1, tag_name: 'v0.1.0' }, { id: 2, tag_name: 'v0.1.0' }], 'v0.1.0'), /exactly one/);
  assert.throws(() => resolveExactRelease([{ id: 'node-id', tag_name: 'v0.1.0' }], 'v0.1.0'), /numeric REST release ID/);
});

test('rejects wrong ID, tag, or draft state before a release can be finalized', () => {
  const draft = { id: 385437440, tag_name: 'v0.1.0', draft: true };
  assert.throws(() => validateReleaseIdentity(draft, 1, 'v0.1.0'), /expected numeric REST release ID/);
  assert.throws(() => validateReleaseIdentity(draft, 385437440, 'v0.1.1'), /not tagged/);
  assert.throws(() => validateReleaseIdentity({ ...draft, draft: undefined }, 385437440, 'v0.1.0'), /draft state/);
});

test('requires release metadata to bind a recovery tag to its qualified source', () => {
  const release = { id: 385437440, tag_name: 'v0.1.0', draft: true, body: '<!-- gateway-release-source:start -->\n- Commit: `source-sha`\n<!-- gateway-release-source:end -->' };
  assert.equal(validateReleaseIdentity(release, 385437440, 'v0.1.0', 'source-sha').releaseId, 385437440);
  assert.throws(() => validateReleaseIdentity(release, 385437440, 'v0.1.0', 'other-sha'), /source provenance/);
});

test('final delivery status cannot pass for missing or failed publication evidence', () => {
  assert.equal(evaluateDelivery({ verifyResult: 'failure' }).finalOutcome, 'FAILED');
  assert.equal(evaluateDelivery({ verifyResult: 'success', publishResult: 'success' }).finalOutcome, 'NO_RELEASE');
  assert.equal(evaluateDelivery({ verifyResult: 'success', publishResult: 'failure', gitTag: 'v0.1.0' }).finalOutcome, 'FAILED');
  assert.equal(evaluateDelivery({ verifyResult: 'success', publishResult: 'success', gitTag: 'v0.1.0', deliveryResult: 'failure' }).finalOutcome, 'FAILED');
  assert.equal(evaluateDelivery({ verifyResult: 'success', publishResult: 'success', gitTag: 'v0.1.0', deliveryResult: 'success' }).finalOutcome, 'PUBLISHED');
  assert.equal(evaluateDelivery({ verifyResult: 'success', publishResult: 'success', gitTag: 'v0.1.0', deliveryResult: 'failure', deliveryOutcome: 'PUBLISHED' }).finalOutcome, 'FAILED');
});
