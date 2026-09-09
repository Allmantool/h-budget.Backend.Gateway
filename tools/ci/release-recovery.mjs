export function decideImagePublication(versionImage, shaImage) {
  if (!versionImage && !shaImage) return 'publish-candidate-both';
  if ((versionImage && versionImage.identity !== 'verified') || (shaImage && shaImage.identity !== 'verified')) return 'fail-unverified-identity';
  if (versionImage && shaImage && versionImage.digest !== shaImage.digest) return 'fail-conflicting-digests';
  if (versionImage && shaImage) return 'already-complete';
  return versionImage ? 'copy-version-to-sha' : 'copy-sha-to-version';
}
