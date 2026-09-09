import { readFile, writeFile } from 'node:fs/promises';

function releaseIdentity(release) {
  if (!release) return undefined;
  return {
    version: release.version,
    gitTag: release.gitTag,
    gitHead: release.gitHead,
    type: release.type,
  };
}

async function updateObservation(context, update) {
  const file = process.env.GATEWAY_RELEASE_DECISION_FILE;
  if (!file) return;

  let current = {};
  try {
    current = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  await writeFile(file, `${JSON.stringify({
    ...current,
    ...update,
    previousRelease: releaseIdentity(context.lastRelease),
    sourceSha: context.nextRelease?.gitHead ?? context.env?.GITHUB_SHA,
  })}\n`);
}

export async function analyzeCommits(_, context) {
  await updateObservation(context, { phase: 'analyzed' });
  return undefined;
}

export async function generateNotes(_, context) {
  await updateObservation(context, {
    phase: 'release-decided',
    nextRelease: releaseIdentity(context.nextRelease),
  });
  return undefined;
}

export async function success(_, context) {
  await updateObservation(context, {
    phase: 'released',
    nextRelease: releaseIdentity(context.nextRelease),
  });
}
