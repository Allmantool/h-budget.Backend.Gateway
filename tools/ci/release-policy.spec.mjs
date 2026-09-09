import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { analyzeCommits } from '@semantic-release/commit-analyzer';
import { generateNotes } from '@semantic-release/release-notes-generator';

import releaseConfig, { BOOTSTRAP_VERSION, isStableTag } from '../../release.config.mjs';
import { classifyReleaseType, validatePullRequest } from './release-policy.mjs';

const semanticReleaseConfig = releaseConfig.plugins[0][1];
const silentLogger = { log() {} };

async function analyze(messages) {
  return analyzeCommits(semanticReleaseConfig, {
    commits: messages.map((message, index) => ({ hash: `synthetic-${index}`, message })),
    cwd: process.cwd(),
    logger: silentLogger,
  });
}

test('classifies patch, minor, and major release rules', async () => {
  for (const [message, expected] of [
    ['fix(gateway): correct route timeout', 'patch'],
    ['feat(gateway): add accounting route', 'minor'],
    ['feat(gateway)!: remove legacy route', 'major'],
    ['fix(gateway): correct route\n\nBREAKING CHANGE: legacy contract was removed', 'major'],
  ]) {
    assert.equal(classifyReleaseType([message]), expected);
    assert.equal(await analyze([message]), expected);
  }
});

test('selects the highest impact and excludes no-release changes', async () => {
  assert.equal(classifyReleaseType(['fix(gateway): correct route', 'feat(gateway): add route']), 'minor');
  assert.equal(await analyze(['fix(gateway): correct route', 'feat(gateway): add route']), 'minor');
  assert.equal(classifyReleaseType(['docs: update runbook', 'test(gateway): add route test', 'style: format']), undefined);
  assert.equal(await analyze(['docs: update runbook', 'test(gateway): add route test', 'style: format']), null);
});

test('validates branch intent without calculating versions from branches', () => {
  assert.equal(validatePullRequest('feature/new-route', 'feat(gateway): add new route'), undefined);
  assert.equal(validatePullRequest('hotfix/route-timeout', 'fix(gateway): correct route timeout'), undefined);
  assert.equal(validatePullRequest('tech/release-contract', 'ci(release): harden tag validation'), undefined);
  assert.match(validatePullRequest('feature/new-route', 'fix(gateway): correct route'), /does not allow/);
  assert.match(validatePullRequest('unsupported/new-route', 'feat(gateway): add route'), /Unsupported branch name/);
});

test('defines stable tag, bootstrap, and release workflow invariants', async () => {
  assert.equal(BOOTSTRAP_VERSION, '1.0.0');
  assert.equal(isStableTag('v1.2.3'), true);
  assert.equal(isStableTag('v0.0.794-build1'), false);
  assert.equal(isStableTag('v1.2.3-rc.1'), false);
  assert.deepEqual(releaseConfig.branches, ['master']);
  assert.equal(releaseConfig.tagFormat, 'v${version}');
  assert.equal(releaseConfig.plugins[2][1].successCommentCondition, false);
  const [policy, commonQuality, release, deployment] = await Promise.all([
    readFile(new URL('../../.github/workflows/ci-master.yml', import.meta.url), 'utf8'),
    readFile(new URL('../../.github/workflows/ci-common.yml', import.meta.url), 'utf8'),
    readFile(new URL('../../.github/workflows/update_semver.yml', import.meta.url), 'utf8'),
    readFile(new URL('../../.github/workflows/release-tag.yml', import.meta.url), 'utf8'),
  ]);
  assert.match(policy, /Gateway PR Gate/);
  assert.match(policy, /needs: \[common-quality, release-policy\]/);
  assert.match(policy, /contents: read/);
  assert.doesNotMatch(policy, /contents: write|git tag|gh release/);
  assert.match(commonQuality, /workflow_call/);
  assert.match(commonQuality, /GATE_REQUIRED_JOBS: validate-configuration,build-and-test,security,workflow-policy,docker-verify/);
  assert.match(release, /group: gateway-release-master/);
  assert.doesNotMatch(release, /GATEWAY_PUBLICATION_ENABLED|HELD/);
  assert.match(release, /uses: \.\/\.github\/workflows\/ci-common\.yml/);
  assert.match(release, /uses: \.\/\.github\/workflows\/release-tag\.yml/);
  assert.doesNotMatch(release, /gh workflow run/);
  assert.match(release, /npx --no-install semantic-release/);
  assert.match(release, /release_id: \$\{\{ steps\.publish\.outputs\.release_id \}\}/);
  assert.match(release, /release_id: \$\{\{ needs\.publish\.outputs\.release_id \}\}/);
  assert.match(release, /deliver:\s+name:[\s\S]*?permissions:\s+contents: write\s+deployments: read\s+pull-requests: write\s+uses: \.\/\.github\/workflows\/release-tag\.yml/);
  assert.doesNotMatch(release, /git push --force|git tag -f/);
  assert.match(deployment, /workflow_call/);
  assert.match(deployment, /release_id:/);
  assert.match(deployment, /releases\/\$RELEASE_ID/);
  assert.match(deployment, /verify-release:[\s\S]*?permissions:\s+contents: write/);
  assert.match(deployment, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(deployment, /record-deployment:[\s\S]*?permissions:\s+contents: write/);
  assert.match(deployment, /grep -q '\^HTTP\/\.\* 403 '/);
  assert.ok(deployment.indexOf('test -z "$EXPECTED_RELEASE_SHA" || test "$EXPECTED_RELEASE_SHA" = "$release_sha"') < deployment.indexOf('gh api -i "repos/$GITHUB_REPOSITORY/releases/$RELEASE_ID"'));
  assert.match(deployment, /\.id == \$releaseId and \.tag_name == \$releaseTag and \.draft == false/);
  assert.doesNotMatch(deployment, /gh release view|gh release edit/);
  assert.doesNotMatch(deployment, /GATEWAY_PUBLICATION_ENABLED|HELD|publication-preflight/);
  assert.match(deployment, /GATEWAY_IMAGE_REPOSITORY: allmantool\/homebudget-backend-gateway/);
  assert.match(deployment, /environment:\s+name: production/);
  assert.match(deployment, /delivery-report\.json/);
  assert.match(deployment, /publication-report:[\s\S]*?pull-requests: write/);
  assert.match(deployment, /commits\/\$commit\/pulls\?per_page=100/);
  assert.match(deployment, /issues\/\$number\/comments\?per_page=100/);
  assert.match(deployment, /recovered-after-ambiguous-create/);
  assert.match(deployment, /tools\/ci\/publication-report\.mjs summary/);
  assert.match(deployment, /BUILD_VERSION=\$\{\{ needs\.verify-release\.outputs\.release_version \}\}/);
  assert.match(deployment, /BUILD_SHA=\$\{\{ needs\.verify-release\.outputs\.release_sha \}\}/);
  assert.match(deployment, /org\.opencontainers\.image\.revision/);
});

test('generates categorized release notes', async () => {
  const [, notesConfig] = releaseConfig.plugins[1];
  const notes = await generateNotes(notesConfig, {
    commits: [{ hash: 'synthetic', message: 'ci(release): harden production pipeline' }],
    lastRelease: { gitTag: 'v1.2.2' },
    nextRelease: { gitTag: 'v1.2.3', version: '1.2.3' },
    options: { repositoryUrl: 'https://github.com/Allmantool/h-budget.Backend.Gateway.git' },
    cwd: process.cwd(),
  });
  assert.match(notes, /Continuous Integration/);
  assert.match(notes, /harden production pipeline/);
});
