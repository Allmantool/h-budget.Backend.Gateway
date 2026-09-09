import assert from 'node:assert/strict';
import test from 'node:test';

import { decideImagePublication } from './release-recovery.mjs';

test('release recovery publishes a new candidate only when both immutable tags are absent', () => {
  assert.equal(decideImagePublication(undefined, undefined), 'publish-candidate-both');
});

test('release recovery converges a partial publication from verified registry evidence', () => {
  assert.equal(decideImagePublication({ identity: 'verified', digest: 'sha256:a' }, undefined), 'copy-version-to-sha');
  assert.equal(decideImagePublication(undefined, { identity: 'verified', digest: 'sha256:a' }), 'copy-sha-to-version');
  assert.equal(decideImagePublication({ identity: 'verified', digest: 'sha256:a' }, { identity: 'verified', digest: 'sha256:a' }), 'already-complete');
});

test('release recovery fails closed for unverified or conflicting existing image identities', () => {
  assert.equal(decideImagePublication({ identity: 'unverified', digest: 'sha256:a' }, undefined), 'fail-unverified-identity');
  assert.equal(decideImagePublication({ identity: 'verified', digest: 'sha256:a' }, { identity: 'verified', digest: 'sha256:b' }), 'fail-conflicting-digests');
});
