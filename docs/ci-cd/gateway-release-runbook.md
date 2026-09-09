# Gateway Release Runbook

## Normal path

1. Keep `GATEWAY_PUBLICATION_ENABLED` unset or other than `true` until an owner has completed the activation ledger. `Gateway Release` verifies the merged SHA but does not publish while the variable is absent or false.
2. Open a PR to `master` and obtain `Gateway PR Gate` for the current merge candidate.
3. Merge through the active ruleset. `Gateway Release` repeats verification on the resulting SHA.
4. Semantic-release may create one immutable tag and a **draft** GitHub Release, then dispatches `Gateway Deployment` with that exact tag and SHA.
5. Deployment builds, smoke-tests, scans, and publishes the exact candidate as SemVer and SHA tags; it verifies the digest, writes trace metadata, then publishes the GitHub Release.

Only a non-draft Release with the traceability block is deployable handoff. Publishing is not production rollout. Deploy by recorded digest and roll back by deploying a previously recorded digest; never move a release tag.

## Recovery

| State | Safe recovery |
| --- | --- |
| No tag or draft | Fix through a PR; do not allocate a manual version. |
| Tag/draft exists and dispatch failed | Run `Gateway Deployment` with the same tag and resolved SHA. |
| Image workflow failed | Rerun `Gateway Deployment`; it uses the existing immutable tag. |
| One image tag exists | The workflow verifies labels/digest and copies that registry image to only the missing tag. |
| Existing tags conflict | Stop; do not overwrite or move either tag. |
| Images exist but trace metadata is absent | Rerun deployment to reconcile metadata and publish the draft. |
| Semantic-release finds no new version | Recover the existing draft through deployment; it will not reallocate a version. |

Retain workflow URL, tag SHA, image digest, and `release-<tag>` artifact. Docker Hub tag immutability/access control remains an operational prerequisite.
