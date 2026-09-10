import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import { missingReportingFiles, workspaceFailure } from './report-workspace.mjs';

const execFile = promisify(execFileCallback);
const reportingScripts = [
  'report-workspace.mjs',
  'release-resolver.mjs',
  'deployment-evidence.mjs',
];

async function withCleanWorkspace(run, scripts = reportingScripts) {
  const workspace = await mkdtemp(join(tmpdir(), 'gateway-report-workspace-'));
  const scriptsDirectory = join(workspace, 'tools', 'ci');
  await mkdir(scriptsDirectory, { recursive: true });
  await Promise.all(scripts.map(script => cp(new URL(`./${script}`, import.meta.url), join(scriptsDirectory, script))));
  try {
    return await run(workspace);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

async function runNode(workspace, ...argumentsList) {
  return execFile(process.execPath, argumentsList, { cwd: workspace, encoding: 'utf8' });
}

test('runs the real reporting helper sequence from an isolated workspace', async () => {
  await withCleanWorkspace(async workspace => {
    await writeFile(join(workspace, 'release.json'), JSON.stringify({ id: 386456250, tag_name: 'v0.1.5', draft: false }));
    await writeFile(join(workspace, 'deployments.json'), JSON.stringify([{ id: 18159703693, environment: 'production' }]));
    await writeFile(join(workspace, 'deployment-statuses.json'), JSON.stringify([{ state: 'success' }]));

    await runNode(workspace, 'tools/ci/report-workspace.mjs');
    const release = await runNode(workspace, 'tools/ci/release-resolver.mjs', '--verify-final', 'release.json', '386456250', 'v0.1.5');
    const deployment = await runNode(workspace, 'tools/ci/deployment-evidence.mjs', 'deployment-id', 'deployments.json', 'production');
    await runNode(workspace, 'tools/ci/deployment-evidence.mjs', 'require-success', 'deployment-statuses.json');

    assert.deepEqual(JSON.parse(release.stdout), { releaseId: 386456250, tag: 'v0.1.5', draft: false });
    assert.equal(deployment.stdout.trim(), '18159703693');
  });
});

test('fails early with a bounded diagnostic when the report workspace is incomplete', async () => {
  await withCleanWorkspace(async workspace => {
    assert.deepEqual(await missingReportingFiles(workspace), ['tools/ci/release-resolver.mjs', 'tools/ci/deployment-evidence.mjs']);
    await assert.rejects(
      () => runNode(workspace, 'tools/ci/report-workspace.mjs'),
      error => /\[GW-REPORT-WORKSPACE\][\s\S]*release-resolver\.mjs[\s\S]*deployment-evidence\.mjs/u.test(error.stderr),
    );
    assert.match(workspaceFailure(['tools/ci/release-resolver.mjs']), /final evidence remains unverified/u);
  }, ['report-workspace.mjs']);
});

test('keeps invalid release and deployment evidence blocking in an isolated workspace', async () => {
  await withCleanWorkspace(async workspace => {
    await writeFile(join(workspace, 'release.json'), JSON.stringify({ id: 7, tag_name: 'v0.1.5', draft: false }));
    await writeFile(join(workspace, 'deployment-statuses.json'), JSON.stringify([{ state: 'failure' }]));

    await assert.rejects(
      () => runNode(workspace, 'tools/ci/release-resolver.mjs', '--verify-final', 'release.json', '386456250', 'v0.1.5'),
      error => /expected numeric REST release ID/u.test(error.stderr),
    );
    await assert.rejects(
      () => runNode(workspace, 'tools/ci/deployment-evidence.mjs', 'require-success', 'deployment-statuses.json'),
      error => /Latest deployment status is failure/u.test(error.stderr),
    );
  });
});
