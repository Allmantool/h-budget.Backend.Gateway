import assert from 'node:assert/strict';
import test from 'node:test';

import { readFile } from 'node:fs/promises';

import { evaluateDelivery } from './delivery-result.mjs';
import { resolveReleaseDecision } from './release-decision.mjs';
import { githubReleaseId } from './release-observer.mjs';
import { discoverRelease, RELEASE_READINESS, resolveExactRelease, validateFinalReleaseIdentity, validateReleaseIdentity } from './release-resolver.mjs';

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

test('discovers GitHub draft releases by stable name and source provenance', async () => {
  const release = JSON.parse(await readFile(new URL('./fixtures/v0.1.4-untagged-draft-release.json', import.meta.url), 'utf8'));
  const sourceSha = 'a9051d26960a5a7f26c6da1503d22504926fba6c';
  assert.deepEqual(discoverRelease([release], 'v0.1.4', sourceSha), {
    code: RELEASE_READINESS.READY,
    retryable: false,
    releaseId: 386116542,
    tag: 'v0.1.4',
    draft: true,
  });
  assert.deepEqual(resolveExactRelease([release], 'v0.1.4', sourceSha), { releaseId: 386116542, tag: 'v0.1.4', draft: true });
});

test('reports distinct discovery diagnostics for missing, metadata, and ambiguity states', () => {
  const sourceSha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  assert.equal(discoverRelease([], 'v0.1.0', sourceSha).code, RELEASE_READINESS.NOT_FOUND_YET);
  assert.equal(discoverRelease([{ id: 1, draft: true, name: 'v0.1.0', body: '' }], 'v0.1.0', sourceSha).code, RELEASE_READINESS.METADATA_PENDING);
  assert.equal(discoverRelease([{ id: 1, draft: true, name: 'v0.1.0', body: '<!-- gateway-release-source:start -->\n- Commit: `bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`\n<!-- gateway-release-source:end -->' }], 'v0.1.0', sourceSha).code, RELEASE_READINESS.METADATA_MISMATCH);
  assert.equal(discoverRelease([{ id: 1, draft: true, name: 'v0.1.0', body: `<!-- gateway-release-source:start -->\n- Tag: \`v0.2.0\`\n- Commit: \`${sourceSha}\`\n<!-- gateway-release-source:end -->` }], 'v0.1.0', sourceSha).code, RELEASE_READINESS.METADATA_MISMATCH);
  assert.equal(discoverRelease([{ id: 1, draft: true, name: 'v0.1.0', body: '<!-- gateway-release-source:start -->\n<!-- gateway-release-source:end -->' }], 'v0.1.0', sourceSha).code, RELEASE_READINESS.METADATA_INVALID);
  assert.equal(discoverRelease([{ id: 1, draft: true, name: 'v0.1.0' }, { id: 2, tag_name: 'v0.1.0', draft: false }], 'v0.1.0', sourceSha).code, RELEASE_READINESS.AMBIGUOUS);
});

test('rejects wrong ID, tag, or draft state before a release can be finalized', () => {
  const draft = { id: 385437440, tag_name: 'v0.1.0', draft: true };
  assert.throws(() => validateReleaseIdentity(draft, 1, 'v0.1.0'), /expected numeric REST release ID/);
  assert.throws(() => validateReleaseIdentity(draft, 385437440, 'v0.1.1'), /not named/);
  assert.throws(() => validateReleaseIdentity({ ...draft, draft: undefined }, 385437440, 'v0.1.0'), /draft state/);
});

test('requires release metadata to bind a recovery tag to its qualified source', () => {
  const sourceSha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const release = { id: 385437440, tag_name: 'untagged-release', name: 'v0.1.0', draft: true, body: `<!-- gateway-release-source:start -->\n- Commit: \`${sourceSha}\`\n<!-- gateway-release-source:end -->` };
  assert.equal(validateReleaseIdentity(release, 385437440, 'v0.1.0', sourceSha).releaseId, 385437440);
  assert.throws(() => validateReleaseIdentity(release, 385437440, 'v0.1.0', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'), /source provenance/);
});

test('accepts only an exact non-draft release during final readback', () => {
  assert.equal(validateFinalReleaseIdentity({ id: 1, tag_name: 'v0.1.0', draft: false }, 1, 'v0.1.0').draft, false);
  assert.throws(() => validateFinalReleaseIdentity({ id: 1, tag_name: 'v0.1.0', draft: true }, 1, 'v0.1.0'), /still a draft/);
});

test('final delivery status cannot pass for missing or failed publication evidence', () => {
  assert.equal(evaluateDelivery({ verifyResult: 'failure' }).finalOutcome, 'FAILED');
  assert.equal(evaluateDelivery({ verifyResult: 'success', publishResult: 'success' }).finalOutcome, 'NO_RELEASE');
  assert.equal(evaluateDelivery({ verifyResult: 'success', publishResult: 'failure', gitTag: 'v0.1.0' }).finalOutcome, 'FAILED');
  assert.equal(evaluateDelivery({ verifyResult: 'success', publishResult: 'success', gitTag: 'v0.1.0', deliveryResult: 'failure' }).finalOutcome, 'FAILED');
  assert.equal(evaluateDelivery({ verifyResult: 'success', publishResult: 'success', gitTag: 'v0.1.0', deliveryResult: 'success' }).finalOutcome, 'PUBLISHED');
  assert.equal(evaluateDelivery({ verifyResult: 'success', publishResult: 'success', gitTag: 'v0.1.0', deliveryResult: 'failure', deliveryOutcome: 'PUBLISHED' }).finalOutcome, 'FAILED');
});
