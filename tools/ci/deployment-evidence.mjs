import { readFile } from 'node:fs/promises';

export function deploymentIdForEnvironment(deployments, environment) {
  const deployment = deployments.find(candidate => candidate.environment === environment && Number.isSafeInteger(candidate.id));
  if (!deployment) throw new Error(`No deployment record exists for environment ${environment}.`);
  return deployment.id;
}

export function requireSuccessfulDeploymentStatus(statuses) {
  if (statuses[0]?.state !== 'success') throw new Error(`Latest deployment status is ${statuses[0]?.state ?? 'missing'}, not success.`);
}

if (import.meta.main) {
  const [mode, file, value] = process.argv.slice(2);
  const document = JSON.parse(await readFile(file, 'utf8'));
  if (mode === 'deployment-id') {
    process.stdout.write(`${deploymentIdForEnvironment(document, value)}\n`);
  } else if (mode === 'require-success') {
    requireSuccessfulDeploymentStatus(document);
  } else {
    throw new Error('Usage: node tools/ci/deployment-evidence.mjs <deployment-id|require-success> <json-file> [environment]');
  }
}
