import { readFile } from 'node:fs/promises';

export function resolveReleaseDecision(observation, recovery) {
  if (recovery?.tag) {
    return {
      decision: 'RECOVERY',
      reason: 'Existing draft GitHub Release matches the current source SHA.',
      version: recovery.tag.slice(1),
      gitTag: recovery.tag,
      sourceSha: recovery.sourceSha,
      previousVersion: observation?.previousRelease?.version ?? null,
      releaseType: observation?.nextRelease?.type ?? null,
    };
  }

  if (!observation?.nextRelease?.gitTag) {
    return {
      decision: 'NO_RELEASE',
      reason: 'semantic-release found no release-producing commit in the analyzed range.',
      version: null,
      gitTag: null,
      sourceSha: observation?.sourceSha ?? null,
      previousVersion: observation?.previousRelease?.version ?? null,
      releaseType: null,
    };
  }

  return {
    decision: 'RELEASED',
    reason: 'semantic-release created the immutable release identity.',
    version: observation.nextRelease.version,
    gitTag: observation.nextRelease.gitTag,
    sourceSha: observation.nextRelease.gitHead ?? observation.sourceSha ?? null,
    previousVersion: observation.previousRelease?.version ?? null,
    releaseType: observation.nextRelease.type ?? null,
  };
}

if (import.meta.main) {
  const [file, recoveryTag, recoverySourceSha] = process.argv.slice(2);
  if (!file) throw new Error('Usage: node tools/ci/release-decision.mjs <observation.json>');
  const observation = JSON.parse(await readFile(file, 'utf8'));
  const recovery = recoveryTag ? { tag: recoveryTag, sourceSha: recoverySourceSha } : undefined;
  process.stdout.write(`${JSON.stringify(resolveReleaseDecision(observation, recovery))}\n`);
}
