import { readFile } from 'node:fs/promises';

const sensitiveKey = /(?:password|secret|token|apikey|api_key|connectionstring)$/i;

export function findCommittedSecrets(value, path = []) {
  if (Array.isArray(value)) return value.flatMap((item, index) => findCommittedSecrets(item, [...path, String(index)]));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => findCommittedSecrets(child, [...path, key]));
  }
  if (sensitiveKey.test(path.at(-1) ?? '') && typeof value === 'string' && value.trim() !== '') return [path.join('.')];
  return [];
}

export async function validateConfigurationFiles(files) {
  const findings = [];
  for (const file of files) {
    let parsed;
    try {
      parsed = JSON.parse(await readFile(file, 'utf8'));
    } catch {
      findings.push(`${file}: invalid JSON`);
      continue;
    }
    for (const path of findCommittedSecrets(parsed)) findings.push(`${file}: committed value at ${path}`);
  }
  return findings;
}

if (import.meta.main) {
  const files = process.argv.slice(2);
  if (files.length === 0) throw new Error('Provide at least one JSON configuration file.');
  const findings = await validateConfigurationFiles(files);
  if (findings.length > 0) {
    console.error('Configuration safety validation failed. Remove committed credential values and inject them at runtime.');
    for (const finding of findings) console.error(finding);
    process.exitCode = 1;
  }
}
