export const REQUIRED_PR_JOBS = Object.freeze([
  'release-policy',
  'validate-configuration',
  'build-and-test',
  'security',
  'workflow-policy',
  'docker-verify',
]);

export function evaluateGate(results, requiredJobs = REQUIRED_PR_JOBS) {
  const blocked = [];
  for (const job of requiredJobs) {
    const result = results?.[job]?.result;
    if (result !== 'success') blocked.push(`${job}: ${result ?? 'missing'}`);
  }
  return { pass: blocked.length === 0, blocked };
}

if (import.meta.main) {
  const rawResults = process.env.GATE_RESULTS;
  let results;
  try {
    results = JSON.parse(rawResults);
  } catch {
    console.error('Gateway PR Gate received missing or malformed required-job evidence.');
    process.exitCode = 1;
    process.exit();
  }
  const evaluation = evaluateGate(results);
  if (!evaluation.pass) {
    console.error(`Gateway PR Gate blocked by: ${evaluation.blocked.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('Gateway PR Gate passed: every required validation explicitly succeeded.');
  }
}
