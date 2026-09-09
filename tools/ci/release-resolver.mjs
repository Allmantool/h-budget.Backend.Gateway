import { readFile } from 'node:fs/promises';

export function resolveExactRelease(releases, tag) {
  const matches = releases.filter(release => release.tag_name === tag);
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one GitHub Release for ${tag}; found ${matches.length}.`);
  }

  return validateReleaseIdentity(matches[0], matches[0].id, tag);
}

export function validateReleaseIdentity(release, releaseId, tag, sourceSha) {
  const numericReleaseId = Number(releaseId);
  if (!Number.isSafeInteger(numericReleaseId) || numericReleaseId < 1 || release?.id !== numericReleaseId) {
    throw new Error(`GitHub Release ${tag} did not provide the expected numeric REST release ID.`);
  }
  if (release.tag_name !== tag) {
    throw new Error(`GitHub Release ID ${numericReleaseId} is not tagged ${tag}.`);
  }
  if (typeof release.draft !== 'boolean') {
    throw new Error(`GitHub Release ID ${numericReleaseId} did not provide a draft state.`);
  }
  if (sourceSha && (!release.body?.includes('<!-- gateway-release-source:start -->') || !release.body.includes(`- Commit: \`${sourceSha}\``))) {
    throw new Error(`GitHub Release ID ${numericReleaseId} has no matching immutable source provenance.`);
  }

  return { releaseId: numericReleaseId, tag: release.tag_name, draft: release.draft };
}

if (import.meta.main) {
  const [first, second, third, fourth, fifth] = process.argv.slice(2);
  if (first === '--verify') {
    if (!second || !third || !fourth) {
      throw new Error('Usage: node tools/ci/release-resolver.mjs --verify <release.json> <release-id> <tag>');
    }
    const release = JSON.parse(await readFile(second, 'utf8'));
    process.stdout.write(`${JSON.stringify(validateReleaseIdentity(release, third, fourth, fifth))}\n`);
    process.exit();
  }

  const [file, tag, sourceSha] = [first, second, third];
  if (!file || !tag || !sourceSha) {
    throw new Error('Usage: node tools/ci/release-resolver.mjs <releases.json> <tag> <source-sha>');
  }
  const pages = JSON.parse(await readFile(file, 'utf8'));
  const releases = Array.isArray(pages[0]) ? pages.flat() : pages;
  const release = resolveExactRelease(releases, tag);
  process.stdout.write(`${JSON.stringify({ ...release, sourceSha })}\n`);
}
