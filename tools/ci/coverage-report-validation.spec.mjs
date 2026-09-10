import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..', '..');
const helper = join(root, 'tools', 'ci', 'validate-coverage-report.sh');
const fixtures = join(root, 'tools', 'ci', 'fixtures', 'coverage');
const bashExecutable = process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : '/bin/bash';
const bashRoot = spawnSync(bashExecutable, ['-c', 'pwd'], { cwd: root, encoding: 'utf8' }).stdout.trim();
const bashTemporaryRoot = spawnSync(bashExecutable, ['-c', 'pwd'], { cwd: tmpdir(), encoding: 'utf8' }).stdout.trim();
const bashPathEnvironment = spawnSync(bashExecutable, ['-c', 'printf %s "$PATH"'], { cwd: root, encoding: 'utf8' }).stdout;

function bashPath(path) {
  const repositoryRelativePath = relative(root, path);
  if (!repositoryRelativePath.startsWith('..')) return join(bashRoot, repositoryRelativePath).replaceAll('\\', '/');
  return join(bashTemporaryRoot, relative(tmpdir(), path)).replaceAll('\\', '/');
}

async function createWorkspace() {
  const directory = await mkdtemp(join(tmpdir(), 'gateway-coverage-policy-'));
  const validatorDirectory = join(directory, 'validator');
  const validatorLog = join(directory, 'xmllint.log');
  const validator = join(validatorDirectory, 'xmllint');
  await mkdir(validatorDirectory);
  await writeFile(validator, `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "${validatorLog}"
if [[ "$1" == '--noout' ]]; then
  grep -q '<malformed' "$2" && { echo 'fixture parser error' >&2; exit 1; }
  exit 0
fi
if [[ "$1" == '--xpath' ]]; then
  grep -q '<coverage>' "$3" && { printf '0'; exit 0; }
  printf '1'
  exit 0
fi
exit 64
`);
  await chmod(validator, 0o755);
  return { directory, validatorDirectory, validatorLog };
}

function validate(report, environment) {
  const result = spawnSync(bashExecutable, ['-c', 'PATH="$VALIDATOR_PATH"; source "$HELPER_PATH" "$REPORT_PATH"'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...environment, PATH: process.env.PATH, VALIDATOR_PATH: environment.validatorPath, HELPER_PATH: bashPath(helper), REPORT_PATH: bashPath(report) },
  });
  if (result.error) throw result.error;
  return result;
}

async function copyFixture(workspace, fixture, targetName = fixture) {
  const target = join(workspace, targetName);
  await cp(join(fixtures, fixture), target);
  return target;
}

test('valid Visual Studio coverage with a spaced path is retained for scanner input', async t => {
  const workspace = await createWorkspace();
  t.after(() => rm(workspace.directory, { recursive: true, force: true }));
  const report = await copyFixture(workspace.directory, 'valid-vscoverage.xml', 'coverage report.xml');
  const githubEnvironment = join(workspace.directory, 'github.env');
  const result = validate(report, { GITHUB_ENV: bashPath(githubEnvironment), validatorPath: `${bashPath(workspace.validatorDirectory)}:${bashPathEnvironment}` });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /COV_REPORT_VALID: path=.*coverage report\.xml bytes=\d+ modules=1/);
  assert.equal(await readFile(githubEnvironment, 'utf8'), `COVERAGE_FILE=${bashPath(report)}\n`);
  const validatorArguments = await readFile(workspace.validatorLog, 'utf8');
  assert.match(validatorArguments, /--noout/);
  assert.match(validatorArguments, /--xpath count\(\/results\/modules\/module/);
});

for (const [name, fixture, expected] of [
  ['missing', 'does-not-exist.xml', /COV_REPORT_MISSING/],
  ['empty', 'empty.xml', /COV_REPORT_EMPTY/],
  ['malformed', 'malformed-vscoverage.xml', /COV_REPORT_MALFORMED: fixture parser error/],
  ['incompatible', 'incompatible.xml', /COV_REPORT_INCOMPATIBLE/],
]) {
  test(`${name} coverage report fails before scanner input is exported`, async t => {
    const workspace = await createWorkspace();
    t.after(() => rm(workspace.directory, { recursive: true, force: true }));
    const report = name === 'missing'
      ? join(workspace.directory, fixture)
      : name === 'empty'
        ? join(workspace.directory, fixture)
        : await copyFixture(workspace.directory, fixture);
    if (name === 'empty') await writeFile(report, '');
    const githubEnvironment = join(workspace.directory, 'github.env');
    const result = validate(report, { GITHUB_ENV: bashPath(githubEnvironment), validatorPath: `${bashPath(workspace.validatorDirectory)}:${bashPathEnvironment}` });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, expected);
    await assert.rejects(readFile(githubEnvironment, 'utf8'));
  });
}

test('validator unavailability is reported as an environment failure', async t => {
  const workspace = await createWorkspace();
  t.after(() => rm(workspace.directory, { recursive: true, force: true }));
  const report = await copyFixture(workspace.directory, 'valid-vscoverage.xml');
  const result = spawnSync(bashExecutable, ['-c', 'PATH="$VALIDATOR_PATH"; source "$HELPER_PATH" "$REPORT_PATH"'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_ENV: bashPath(join(workspace.directory, 'github.env')), VALIDATOR_PATH: bashPath(workspace.directory), HELPER_PATH: bashPath(helper), REPORT_PATH: bashPath(report) },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /COV_REPORT_VALIDATOR_UNAVAILABLE/);
});

test('zero covered lines remains valid coverage input', async t => {
  const workspace = await createWorkspace();
  t.after(() => rm(workspace.directory, { recursive: true, force: true }));
  const report = await copyFixture(workspace.directory, 'zero-covered-vscoverage.xml');
  const githubEnvironment = join(workspace.directory, 'github.env');
  const result = validate(report, { GITHUB_ENV: bashPath(githubEnvironment), validatorPath: `${bashPath(workspace.validatorDirectory)}:${bashPathEnvironment}` });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(githubEnvironment, 'utf8'), `COVERAGE_FILE=${bashPath(report)}\n`);
});

test('validated path is passed to the scanner as one quoted Visual Studio coverage argument', async t => {
  const workspace = await createWorkspace();
  t.after(() => rm(workspace.directory, { recursive: true, force: true }));
  const report = await copyFixture(workspace.directory, 'valid-vscoverage.xml', 'coverage report.xml');
  const githubEnvironment = join(workspace.directory, 'github.env');
  const scannerArguments = join(workspace.directory, 'scanner-arguments.txt');
  const result = spawnSync(bashExecutable, ['-c', 'PATH="$VALIDATOR_PATH"; source "$HELPER_PATH" "$REPORT_PATH"; export COVERAGE_FILE="$(cut -d= -f2- "$GITHUB_ENV")"; dotnet-sonarscanner() { printf "%s\\n" "$@" > "$SCANNER_ARGUMENTS"; }; source "$SCANNER_SCRIPT"'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_ENV: bashPath(githubEnvironment), GITHUB_RUN_ID: 'fixture-run', SONAR_TOKEN: 'fixture-token', PATH: process.env.PATH, VALIDATOR_PATH: `${bashPath(workspace.validatorDirectory)}:${bashPathEnvironment}`, HELPER_PATH: bashPath(helper), REPORT_PATH: bashPath(report), SCANNER_ARGUMENTS: bashPath(scannerArguments), SCANNER_SCRIPT: bashPath(join(root, 'startsonar.sh')) },
  });

  assert.equal(result.status, 0, result.stderr);
  const argumentsText = await readFile(scannerArguments, 'utf8');
  assert.match(argumentsText, new RegExp(`sonar\\.cs\\.vscoveragexml\\.reportsPaths=${bashPath(report).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
});
