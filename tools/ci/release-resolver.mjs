import { readFile } from 'node:fs/promises';

export const RELEASE_READINESS = Object.freeze({
  READY: 'RELEASE_READY',
  NOT_FOUND_YET: 'RELEASE_NOT_FOUND_YET',
  METADATA_PENDING: 'RELEASE_METADATA_PENDING',
  METADATA_MISMATCH: 'RELEASE_METADATA_MISMATCH',
  METADATA_INVALID: 'RELEASE_METADATA_INVALID',
  AMBIGUOUS: 'RELEASE_AMBIGUOUS',
});

function result(code, detail, release) {
  return {
    code,
    retryable: code === RELEASE_READINESS.NOT_FOUND_YET || code === RELEASE_READINESS.METADATA_PENDING,
    ...(detail ? { detail } : {}),
    ...(release ? { releaseId: release.id, tag: release.draft ? release.name : release.tag_name, draft: release.draft } : {}),
  };
}

function uniqueCandidates(releases, tag) {
  return releases.filter((release, index, candidates) =>
    (release?.tag_name === tag || (release?.draft === true && release?.name === tag)) &&
    candidates.findIndex(candidate => candidate?.id === release?.id) === index,
  );
}

function sourceMetadata(release) {
  const body = release?.body;
  if (typeof body !== 'string' || !body.includes('<!-- gateway-release-source:start -->')) {
    return { state: 'pending', detail: 'The draft release has not received source provenance yet.' };
  }

  const blocks = body.match(/<!-- gateway-release-source:start -->([\s\S]*?)<!-- gateway-release-source:end -->/g) ?? [];
  if (blocks.length !== 1) {
    return { state: 'invalid', detail: 'Source provenance must contain exactly one complete marker block.' };
  }

  const commit = blocks[0].match(/^- Commit: `([0-9a-f]{40})`$/m)?.[1];
  if (!commit) {
    return { state: 'invalid', detail: 'Source provenance does not contain a valid full commit SHA.' };
  }

  const tagLine = blocks[0].match(/^- Tag: `(.*)`$/m)?.[1];
  if (blocks[0].includes('- Tag:') && !/^v\d+\.\d+\.\d+$/.test(tagLine ?? '')) {
    return { state: 'invalid', detail: 'Source provenance contains an invalid release tag.' };
  }

  return { state: 'ready', commit, tag: tagLine };
}

function validateCandidateIdentity(release, tag) {
  if (!Number.isSafeInteger(release?.id) || release.id < 1) return 'The GitHub Release did not provide a numeric REST ID.';
  if (typeof release.draft !== 'boolean') return `GitHub Release ${release.id} did not provide a draft state.`;
  if (release.draft && release.name !== tag && release.tag_name !== tag) return `Draft GitHub Release ${release.id} is not named ${tag}.`;
  if (!release.draft && release.tag_name !== tag) return `Published GitHub Release ${release.id} is not tagged ${tag}.`;
  return undefined;
}

export function discoverRelease(releases, tag, sourceSha) {
  const candidates = uniqueCandidates(releases, tag);
  if (candidates.length === 0) return result(RELEASE_READINESS.NOT_FOUND_YET, `No published or draft GitHub Release for ${tag} is visible yet.`);
  if (candidates.length > 1) return result(RELEASE_READINESS.AMBIGUOUS, `Found ${candidates.length} GitHub Releases for ${tag}.`);

  const release = candidates[0];
  const identityError = validateCandidateIdentity(release, tag);
  if (identityError) return result(RELEASE_READINESS.METADATA_INVALID, identityError, release);

  const metadata = sourceMetadata(release);
  if (metadata.state === 'pending') return result(RELEASE_READINESS.METADATA_PENDING, metadata.detail, release);
  if (metadata.state === 'invalid') return result(RELEASE_READINESS.METADATA_INVALID, metadata.detail, release);
  if (metadata.tag && metadata.tag !== tag) return result(RELEASE_READINESS.METADATA_MISMATCH, `Source provenance tag ${metadata.tag} does not match requested tag ${tag}.`, release);
  if (metadata.commit !== sourceSha) return result(RELEASE_READINESS.METADATA_MISMATCH, `Source provenance commit ${metadata.commit} does not match qualified source ${sourceSha}.`, release);
  return result(RELEASE_READINESS.READY, undefined, release);
}

export function resolveExactRelease(releases, tag, sourceSha) {
  const discovery = discoverRelease(releases, tag, sourceSha);
  if (discovery.code !== RELEASE_READINESS.READY) throw new Error(`${discovery.code}: ${discovery.detail}`);
  return { releaseId: discovery.releaseId, tag: discovery.tag, draft: discovery.draft };
}

export function validateReleaseIdentity(release, releaseId, tag, sourceSha) {
  const numericReleaseId = Number(releaseId);
  if (!Number.isSafeInteger(numericReleaseId) || numericReleaseId < 1 || release?.id !== numericReleaseId) {
    throw new Error(`GitHub Release ${tag} did not provide the expected numeric REST release ID.`);
  }
  const identityError = validateCandidateIdentity(release, tag);
  if (identityError) throw new Error(identityError);
  if (sourceSha) {
    const metadata = sourceMetadata(release);
    if (metadata.state !== 'ready' || metadata.tag && metadata.tag !== tag || metadata.commit !== sourceSha) throw new Error(`GitHub Release ID ${numericReleaseId} has no matching immutable source provenance.`);
  }
  return { releaseId: numericReleaseId, tag, draft: release.draft };
}

export function validateFinalReleaseIdentity(release, releaseId, tag) {
  const identity = validateReleaseIdentity(release, releaseId, tag);
  if (identity.draft) throw new Error(`GitHub Release ID ${identity.releaseId} is still a draft.`);
  return identity;
}

if (import.meta.main) {
  const [first, second, third, fourth, fifth] = process.argv.slice(2);
  if (first === '--verify') {
    if (!second || !third || !fourth) throw new Error('Usage: node tools/ci/release-resolver.mjs --verify <release.json> <release-id> <tag> [source-sha]');
    const release = JSON.parse(await readFile(second, 'utf8'));
    process.stdout.write(`${JSON.stringify(validateReleaseIdentity(release, third, fourth, fifth))}\n`);
    process.exit();
  }
  if (first === '--verify-final') {
    if (!second || !third || !fourth) throw new Error('Usage: node tools/ci/release-resolver.mjs --verify-final <release.json> <release-id> <tag>');
    const release = JSON.parse(await readFile(second, 'utf8'));
    process.stdout.write(`${JSON.stringify(validateFinalReleaseIdentity(release, third, fourth))}\n`);
    process.exit();
  }
  if (!first || !second || !third) throw new Error('Usage: node tools/ci/release-resolver.mjs <releases.json> <tag> <source-sha>');
  const pages = JSON.parse(await readFile(first, 'utf8'));
  const releases = Array.isArray(pages) ? (Array.isArray(pages[0]) ? pages.flat() : pages) : [pages];
  process.stdout.write(`${JSON.stringify(discoverRelease(releases, second, third))}\n`);
}
