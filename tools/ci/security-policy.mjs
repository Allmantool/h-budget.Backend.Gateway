import { readFile } from 'node:fs/promises';

function collectVulnerabilities(value, results = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectVulnerabilities(item, results);
  } else if (value && typeof value === 'object') {
    if (Array.isArray(value.vulnerabilities)) results.push(...value.vulnerabilities);
    for (const child of Object.values(value)) collectVulnerabilities(child, results);
  }
  return results;
}

export function evaluateNugetAudit(audit) {
  const findings = collectVulnerabilities(audit);
  if (findings.length > 0) return { pass: false, reason: `${findings.length} vulnerable NuGet package(s) reported` };
  return { pass: true, reason: 'No vulnerable NuGet packages reported' };
}

if (import.meta.main) {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: node tools/ci/security-policy.mjs <dotnet-audit.json>');
  let audit;
  try {
    audit = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    console.error('NuGet vulnerability audit is missing or malformed.');
    process.exitCode = 1;
    process.exit();
  }
  const result = evaluateNugetAudit(audit);
  console.log(result.reason);
  if (!result.pass) process.exitCode = 1;
}
