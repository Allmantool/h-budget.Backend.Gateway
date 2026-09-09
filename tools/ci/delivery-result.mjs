export function evaluateDelivery(evidence) {
  if (evidence.verifyResult !== 'success') {
    return { finalOutcome: 'FAILED', reason: `Release qualification result: ${evidence.verifyResult ?? 'missing'}.` };
  }
  if (evidence.publishResult !== 'success') {
    return { finalOutcome: 'FAILED', reason: `Release publication job result: ${evidence.publishResult ?? 'missing'}.` };
  }
  if (!evidence.gitTag) {
    return { finalOutcome: 'NO_RELEASE', reason: 'semantic-release produced no release identity.' };
  }
  if (evidence.deliveryResult !== 'success') {
    return { finalOutcome: 'FAILED', reason: `Versioned delivery result: ${evidence.deliveryResult ?? 'missing'}.` };
  }
  return { finalOutcome: 'PUBLISHED', reason: 'Immutable release, registry artifact, and environment publication record were verified.' };
}

if (import.meta.main) {
  const evidence = JSON.parse(process.env.DELIVERY_EVIDENCE ?? '{}');
  const result = evaluateDelivery(evidence);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
