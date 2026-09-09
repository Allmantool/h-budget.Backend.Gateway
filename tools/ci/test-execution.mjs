import { readFile } from 'node:fs/promises';

export function executedTestCount(trx) {
  const match = /<Counters\b[^>]*\btotal="(\d+)"/i.exec(trx);
  return match ? Number(match[1]) : Number.NaN;
}

if (import.meta.main) {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: node tools/ci/test-execution.mjs <trx-file>');
  const count = executedTestCount(await readFile(file, 'utf8'));
  if (!Number.isInteger(count) || count < 1) {
    console.error('Gateway test execution evidence is missing or reports zero tests.');
    process.exitCode = 1;
  } else {
    console.log(`Gateway test execution count: ${count}`);
  }
}
