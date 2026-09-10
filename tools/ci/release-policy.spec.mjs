import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { analyzeCommits } from '@semantic-release/commit-analyzer';
import releaseConfig, { BOOTSTRAP_VERSION, GATEWAY_RELEASE_SOURCE_TEMPLATE, isStableTag } from '../../release.config.mjs';
import { classifyReleaseType, validatePullRequest } from './release-policy.mjs';

const semanticReleaseConfig = releaseConfig.plugins[0][1];
const logger = { log() {} };

async function analyze(message) {
  return analyzeCommits(semanticReleaseConfig, { commits: [{ hash: 'synthetic', message }], cwd: process.cwd(), logger });
}

test('classifies production conventional commits and preserves no-release ranges', async () => {
  for (const [message, expected] of [
    ['fix(gateway): correct route timeout', 'patch'],
    ['feat(gateway): add accounting route', 'minor'],
    ['feat(gateway)!: remove legacy route', 'major'],
    ['fix(gateway): correct route\n\nBREAKING CHANGE: legacy contract was removed', 'major'],
  ]) {
    assert.equal(classifyReleaseType([message]), expected);
    assert.equal(await analyze(message), expected);
  }
  assert.equal(await analyze('docs: update runbook'), null);
  assert.equal(validatePullRequest('feature/new-route', 'feat(gateway): add route'), undefined);
  assert.match(validatePullRequest('unsupported/new-route', 'feat(gateway): add route'), /GW-PR-006/);
  assert.equal(validatePullRequest('tech/improve-ci-cd', 'ci(gateway): improve CI\/CD verification'), undefined);
  assert.match(validatePullRequest('tech/improve-ci-cd', 'tech: improve ci / cd'), /\[GW-PR-001\].*tech.*ci\(gateway\)/);
  assert.match(validatePullRequest('tech/improve-ci-cd', 'ci(gateway): '), /GW-PR-004/);
  assert.match(validatePullRequest('tech/improve-ci-cd', 'ci(): improve'), /GW-PR-003/);
  assert.match(validatePullRequest('tech/improve-ci-cd', 'ci gateway improve'), /GW-PR-005/);
});

test('keeps only the three production entry points and fail-closed quality requirements', async () => {
  assert.equal(BOOTSTRAP_VERSION, '1.0.0');
  assert.equal(isStableTag('v1.2.3'), true);
  assert.equal(isStableTag('v1.2.3-rc.1'), false);
  const [pr, common, release, deployment, sonar] = await Promise.all([
    readFile(new URL('../../.github/workflows/ci-master.yml', import.meta.url), 'utf8'),
    readFile(new URL('../../.github/workflows/ci-common.yml', import.meta.url), 'utf8'),
    readFile(new URL('../../.github/workflows/update_semver.yml', import.meta.url), 'utf8'),
    readFile(new URL('../../.github/workflows/release-tag.yml', import.meta.url), 'utf8'),
    readFile(new URL('../../startsonar.sh', import.meta.url), 'utf8'),
  ]);
  assert.match(pr, /Gateway PR Gate/);
  assert.match(pr, /run-name: Gateway PR #/);
  assert.match(common, /SONAR_TOKEN:\s+required: true/);
  assert.match(common, /Enforce Gateway Sonar non-coverage policy/);
  assert.match(common, /Run mandatory Gateway tests/);
  assert.match(common, /Collect Gateway coverage \(advisory\)[\s\S]*?continue-on-error: true/);
  assert.match(common, /Coverage: UNKNOWN\/UNAVAILABLE/);
  assert.match(common, /Prepare advisory coverage import/);
  assert.match(common, /GATE_REQUIRED_JOBS: validate-configuration,build-and-test,security,workflow-policy,docker-verify,sonar/);
  assert.doesNotMatch(common, /optional Sonar|sonar-mode/);
  assert.match(sonar, /sonar\.qualitygate\.wait=false/);
  assert.match(sonar, /\[\[ ! -v COVERAGE_FILE \]\]/);
  assert.match(common, /Evaluate exact Sonar analysis and Gateway non-coverage policy/);
  assert.ok(common.indexOf('dotnet-sonarscanner end') < common.indexOf('Evaluate exact Sonar analysis and Gateway non-coverage policy'));
  assert.match(release, /name: Gateway Build & Release/);
  assert.match(release, /GH_TOKEN: \$\{\{ secrets\.GH_PAT \}\}/);
  assert.match(GATEWAY_RELEASE_SOURCE_TEMPLATE, /gateway-release-source:start/);
  assert.match(GATEWAY_RELEASE_SOURCE_TEMPLATE, /<%= nextRelease\.gitHead %>/);
  assert.equal(releaseConfig.plugins[2][1].releaseBodyTemplate, GATEWAY_RELEASE_SOURCE_TEMPLATE);
  assert.doesNotMatch(release, /uses:\s+\.\/\.github\/workflows\/release-tag\.yml/);
  assert.match(deployment, /push:\s+tags: \['v\*'\]/);
  assert.match(deployment, /workflow_dispatch/);
  assert.match(deployment, /run-name: Gateway Deploy/);
  assert.match(deployment, /MASTER_QUALITY_CHECK/);
  assert.match(deployment, /RELEASE_NOT_FOUND_YET/);
  assert.match(deployment, /RELEASE_API_ACCESS_DENIED/);
  assert.match(deployment, /RELEASE_PRODUCER_FAILED/);
  assert.match(deployment, /github\.event_name == 'workflow_dispatch' && inputs\.release_tag \|\| github\.ref_name/);
  assert.match(deployment, /environment:\s+name: production/);
  assert.doesNotMatch(deployment, /workflow_call|pull-requests: write|publication-report/);
});
