import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { planCommentUpsert, renderPublicationComment, renderPublicationSummary, selectMergedPullRequests, validatePublication } from './publication-report.mjs';

const report = {
  finalOutcome: 'PUBLISHED', gitTag: 'v0.1.2', sourceSha: 'ce1b639ae97b0c6e1635e76f0c81d533b09b1f25', workflowSha: 'fde559af7f4a1e89c91fbc59dd24cb47fa1b421c',
  releaseId: '385577746', releaseUrl: 'https://github.com/Allmantool/h-budget.Backend.Gateway/releases/tag/v0.1.2', sourceUrl: 'https://github.com/Allmantool/h-budget.Backend.Gateway/commit/ce1b639ae97b0c6e1635e76f0c81d533b09b1f25',
  workflowUrl: 'https://github.com/Allmantool/h-budget.Backend.Gateway/actions/runs/34361835433/attempts/1', environmentUrl: 'https://github.com/Allmantool/h-budget.Backend.Gateway/deployments/activity_log?environment=production',
  imageVersionTag: 'allmantool/homebudget-backend-gateway:0.1.2', imageDigestReference: 'allmantool/homebudget-backend-gateway@sha256:2e483e847eac37afe1133a8b0c762cdbb99cb62dd259dfc5a422fce7d230e182',
  imageDigest: 'sha256:2e483e847eac37afe1133a8b0c762cdbb99cb62dd259dfc5a422fce7d230e182', operationKind: 'registry-publication', deploymentStatus: 'success', runId: '34361835433', runAttempt: '1', releasePublishedAt: '2026-09-09T14:17:52Z',
};

test('renders verified Docker Hub publication identity without a runtime deployment claim', () => {
  const comment = renderPublicationComment(report);
  assert.match(comment, /Gateway v0\.1\.2 published to Docker Hub/);
  assert.match(comment, /allmantool\/homebudget-backend-gateway@sha256:2e483/);
  assert.match(comment, /registry publication/);
  assert.match(comment, /Runtime deployment is not configured/);
  assert.match(comment, /gateway-publication:v0\.1\.2:production/);
});

test('selects only deduplicated merged master pull requests from paginated commit associations', () => {
  const pullRequests = selectMergedPullRequests([
    { number: 12, state: 'closed', merged_at: '2026-09-09T14:00:00Z', html_url: 'https://github.test/pr/12', base: { ref: 'master', repo: { full_name: 'Allmantool/h-budget.Backend.Gateway' } } },
    { number: 12, state: 'closed', merged_at: '2026-09-09T14:00:00Z', html_url: 'https://github.test/pr/12', base: { ref: 'master', repo: { full_name: 'Allmantool/h-budget.Backend.Gateway' } } },
    { number: 11, state: 'closed', merged_at: '2026-09-09T13:00:00Z', html_url: 'https://github.test/pr/11', base: { ref: 'master', repo: { full_name: 'Allmantool/h-budget.Backend.Gateway' } } },
    { number: 13, state: 'open', html_url: 'https://github.test/pr/13', base: { ref: 'master', repo: { full_name: 'Allmantool/h-budget.Backend.Gateway' } } },
    { number: 14, state: 'closed', merged_at: '2026-09-09T14:00:00Z', html_url: 'https://github.test/pr/14', base: { ref: 'other', repo: { full_name: 'Allmantool/h-budget.Backend.Gateway' } } },
  ], 'Allmantool/h-budget.Backend.Gateway');
  assert.deepEqual(pullRequests, [{ number: 11, url: 'https://github.test/pr/11' }, { number: 12, url: 'https://github.test/pr/12' }]);
});

test('upserts only the matching automation-owned version marker and preserves human comments', () => {
  const human = { id: 1, body: '<!-- home-ledger:gateway-publication:v0.1.2:production --> human', user: { login: 'pavel' } };
  assert.equal(planCommentUpsert([human], report).action, 'create');
  const body = renderPublicationComment(report);
  const owned = { id: 2, html_url: 'https://github.test/comments/2', body, user: { login: 'github-actions[bot]' } };
  assert.equal(planCommentUpsert([human, owned], report).action, 'unchanged');
  assert.equal(planCommentUpsert([{ ...owned, body: `${body.split('\n', 1)[0]}\noutdated` }], report).action, 'update');
  assert.throws(() => planCommentUpsert([owned, { ...owned, id: 3 }], report), /multiple automation-owned/);
});

test('rejects incomplete or non-published evidence and renders an explicit no-match summary', () => {
  assert.throws(() => validatePublication({ ...report, finalOutcome: 'FAILED' }), /PUBLISHED/);
  assert.throws(() => validatePublication({ ...report, imageDigest: '' }), /imageDigest/);
  assert.match(renderPublicationSummary(report, []), /No matching merged pull requests/);
});

test('renders the verified v0.1.2 evidence fixture without treating it as a runtime deployment', async () => {
  const fixture = JSON.parse(await readFile(new URL('./fixtures/publication-report-v0.1.2.json', import.meta.url), 'utf8'));
  assert.equal(validatePublication(fixture).releaseId, '385577746');
  assert.match(renderPublicationSummary(fixture, []), /Gateway v0\.1\.2 published to Docker Hub/);
});
