import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const bashExecutable = process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : '/bin/bash';

test('a missing required coverage report prevents scanner invocation', () => {
  const result = spawnSync(bashExecutable, ['-c', 'export COVERAGE_FILE="" GITHUB_RUN_ID="fixture-run" SONAR_TOKEN="fixture-token"; dotnet-sonarscanner() { printf "%s\\n" "$@"; }; source ./startsonar.sh'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
  });
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stdout, /sonar\.cs\.vscoveragexml\.reportsPaths/);
  assert.doesNotMatch(result.stdout, /begin/);
  assert.match(result.stderr, /COV_REPORT_PATH_UNSET/);
});
