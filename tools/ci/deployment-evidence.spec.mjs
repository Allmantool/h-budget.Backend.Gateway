import assert from 'node:assert/strict';
import test from 'node:test';

import { deploymentIdForEnvironment, requireSuccessfulDeploymentStatus } from './deployment-evidence.mjs';

test('selects only a real deployment for the requested environment', () => {
  assert.equal(deploymentIdForEnvironment([{ id: 1, environment: 'staging' }, { id: 2, environment: 'production' }], 'production'), 2);
  assert.throws(() => deploymentIdForEnvironment([{ id: '2', environment: 'production' }], 'production'), /No deployment/);
});

test('requires a successful latest deployment status', () => {
  assert.doesNotThrow(() => requireSuccessfulDeploymentStatus([{ state: 'success' }]));
  assert.throws(() => requireSuccessfulDeploymentStatus([{ state: 'failure' }]), /not success/);
  assert.throws(() => requireSuccessfulDeploymentStatus([]), /not success/);
});
