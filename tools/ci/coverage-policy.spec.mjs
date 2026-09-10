import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('an explicitly unavailable advisory coverage report is omitted from Sonar arguments', () => {
  const result = spawnSync('bash', ['-c', 'export COVERAGE_FILE="" GITHUB_RUN_ID="fixture-run" SONAR_TOKEN="fixture-token"; dotnet-sonarscanner() { printf "%s\\n" "$@"; }; source ./startsonar.sh'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /sonar\.cs\.vscoveragexml\.reportsPaths/);
  assert.match(result.stdout, /Coverage is unavailable; continuing without advisory coverage import/);
});
