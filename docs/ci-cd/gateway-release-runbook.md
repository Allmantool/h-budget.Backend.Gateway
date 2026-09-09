# Gateway Release Runbook

## Normal path

1. Inspect the sole repository control and workflow state: `pwsh .\tools\ci\configure-publication.ps1 -Mode Inspect`. Any value other than `true` is **HELD**.
2. Open a PR to `master` and obtain `Gateway PR Gate` for the current merge candidate.
3. Merge through the active ruleset. `Gateway Release` repeats verification on the resulting SHA and records either `HELD`, `NO_RELEASE`, or a semantic-release identity.
4. With explicit release-owner authorization, set the repository variable using `pwsh .\tools\ci\configure-publication.ps1 -Mode Enable`. Changing the variable does not replay an earlier push.
5. The next eligible protected merge creates one immutable tag and a **draft** GitHub Release, then directly calls the versioned delivery workflow with that exact tag and SHA.
6. Delivery builds and smoke-tests the exact image archive, publishes only the SemVer and SHA tags, verifies their remote digest, records the real Docker Hub publication under `production`, writes trace metadata, and finalizes the GitHub Release.

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

## Hold and enablement

`Inspect`, `Enable`, and `Disable` modes in `tools/ci/configure-publication.ps1` are the supported switch procedure. `Disable` writes `false`, which fails closed; it does not cancel running work. Before either change, inspect queued and in-progress runs as the helper does. An explicit manual delivery while held must fail its preflight and cannot be reported as deployed.

The `production` Environment records **registry publication**, not runtime rollout. A runtime deployment requires an owner-provided target mechanism that consumes the verified digest and proves its own health; without one, report `PUBLISHED` and `RUNTIME DEPLOYMENT: NOT CONFIGURED`.
