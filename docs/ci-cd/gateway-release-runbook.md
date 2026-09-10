# Gateway Release Runbook

> Current normal path: PR verification -> master build/release -> automatically tag-triggered deployment. `Gateway Build & Release — master` only creates the semantic tag/draft release provenance; `Gateway Deploy vX.Y.Z` owns Docker publication, production Environment evidence, and release finalization. Do not dispatch for a new version. Dispatch only an existing immutable tag to recover a partial delivery; it verifies the exact qualified source/provenance and converges without moving tags. PR publication comments are no longer part of this path.

## Normal path

1. Open a PR to `master` and obtain `Gateway PR Gate` for the current merge candidate.
2. Merge through the active ruleset. `Gateway Release` repeats common quality checks for the resulting SHA, then semantic-release analyzes the actual release range.
3. A release-producing range creates one immutable tag and a **draft** GitHub Release. The PAT-authenticated tag push starts `Gateway Deployment`; the producer never calls it. A no-release range reports `NO_RELEASE` with the semantic-release baseline/reason.
4. Delivery builds and smoke-tests the exact image archive, publishes only the SemVer and SHA tags, verifies their remote digest, records the real Docker Hub publication under `production`, writes trace metadata, and finalizes the GitHub Release.
5. The delivery-result job reads the release, registry, and Environment evidence back and writes the verified result to the workflow summary.

Only a non-draft Release with the traceability block is deployable handoff. Publishing is not production rollout. Deploy by recorded digest and roll back by deploying a previously recorded digest; never move a release tag.

## Recovery

| State | Safe recovery |
| --- | --- |
| No tag or draft | Fix through a PR; do not allocate a manual version. |
| Tag/draft exists and dispatch failed | Run `Gateway Deployment` from the trusted default-branch workflow revision with the same tag. It resolves the numeric Release REST ID from the qualified source provenance. |
| Image workflow failed | Rerun `Gateway Deployment` with the same tag; it uses the existing immutable tag and resolved draft. |
| One image tag exists | The workflow verifies labels/digest and copies that registry image to only the missing tag. |
| Existing tags conflict | Stop; do not overwrite or move either tag. |
| Images exist but trace metadata is absent | Rerun deployment to reconcile metadata and publish the draft. |
| Semantic-release finds no new version | Recover the existing draft through deployment; it will not reallocate a version. |

GitHub assigns draft releases an opaque `untagged-*` `tag_name`. This is expected: recovery/discovery resolves a draft by its stable release name (`vMAJOR.MINOR.PATCH`) and initial source-provenance marker, then validates its numeric REST ID. `RELEASE_NOT_FOUND_YET` and `RELEASE_METADATA_PENDING` are retried; `RELEASE_API_ACCESS_DENIED`, `RELEASE_API_ERROR`, `RELEASE_PRODUCER_FAILED`, `RELEASE_METADATA_MISMATCH`, `RELEASE_METADATA_INVALID`, and `RELEASE_AMBIGUOUS` stop with their explicit diagnostic.

Retain workflow URL, tag SHA, numeric GitHub Release REST ID, image digest, and `release-<tag>` artifact. Docker Hub tag immutability/access control remains an operational prerequisite.

The `production` Environment records **registry publication**, not runtime rollout. A runtime deployment requires an owner-provided target mechanism that consumes the verified digest and proves its own health; without one, report `PUBLISHED` and `RUNTIME DEPLOYMENT: NOT CONFIGURED`.
