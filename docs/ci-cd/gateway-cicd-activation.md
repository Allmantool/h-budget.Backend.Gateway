# Gateway CI/CD Activation and Delivery Ledger

## Normal operation

```text
Open PR -> Gateway PR Gate passes -> merge to master -> automatic versioned publication
```

The PR workflow is read-only. It runs PR policy validation and the reusable common quality workflow on GitHub's current merge candidate. The required check is **Gateway PR Gate** and it succeeds only when both dependencies explicitly succeed.

A merge to `master` runs the same common quality workflow for the resulting commit. Semantic-release then analyzes the real reachable commit range. A release identity directly invokes the reusable publication workflow; an actual no-release decision is reported as `NO_RELEASE`. There is no publication switch: stale repository variables have no effect.

Publication requires GitHub and Docker Hub credentials in trusted jobs. Failed authentication, a failed push, or missing release/registry/Environment readback produces `FAILED`, not a skipped success. The `production` Environment records Docker Hub registry publication, not a runtime Gateway rollout.

## One-time GitHub enforcement

Workflow YAML emits a required check but cannot enforce pull requests by itself. After a real successful **Gateway PR Gate** check has been emitted, an administrator applies and reads back the Gateway ruleset:

```powershell
pwsh -NoProfile -File tools/ci/configure-merge-protection.ps1 -Mode Inspect
pwsh -NoProfile -File tools/ci/configure-merge-protection.ps1 -Mode Apply
```

The helper preserves unrelated/inherited protection and configures the `master` ruleset with required pull requests, zero required approvals, fresh checks, no normal bypass actors, and the observed GitHub Actions publisher for **Gateway PR Gate**. This repository change does not claim that remote enforcement has been applied.

## Outcome labels

- `PUBLISHED`: immutable tag, finalized GitHub Release, matching remote version/SHA Docker tags and digest, and the `production` registry-publication record were read back.
- `NO_RELEASE`: semantic-release found no release-producing commit in the analyzed range.
- `FAILED`: required qualification, release, publication, or evidence readback failed.

Cancelled runs remain cancelled. For an incomplete release, retry the existing immutable release identity; do not create a new version or overwrite a conflicting tag/image.
