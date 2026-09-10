import { access, constants } from 'node:fs/promises';
import { resolve } from 'node:path';

const REQUIRED_REPORTING_FILES = Object.freeze([
  'tools/ci/release-resolver.mjs',
  'tools/ci/deployment-evidence.mjs',
]);

export async function missingReportingFiles(root = process.cwd()) {
  const checks = await Promise.all(REQUIRED_REPORTING_FILES.map(async file => {
    try {
      await access(resolve(root, file), constants.R_OK);
      return undefined;
    } catch {
      return file;
    }
  }));
  return checks.filter(Boolean);
}

export function workspaceFailure(missingFiles) {
  return [
    '[GW-REPORT-WORKSPACE] Required reporting script is unavailable:',
    ...missingFiles.map(file => `  ${file}`),
    "Check this job's checkout step, checkout revision, and working directory.",
    'Publication results have not been rolled back; final evidence remains unverified.',
  ].join('\n');
}

if (import.meta.main) {
  const missingFiles = await missingReportingFiles();
  if (missingFiles.length > 0) {
    console.error(workspaceFailure(missingFiles));
    process.exitCode = 1;
  }
}
