# Gateway PR Verification and Merge Protection

> Current policy: Sonar scan/upload and the repository-owned non-coverage evaluation are mandatory and included in the common-quality aggregate. Missing credentials, skipped/cancelled work, task/API/correlation failure, or a failed non-coverage condition fails `Gateway PR Gate`. Coverage-only gate rejections are reported as warnings. Public GitHub Rules API inspection on 2026-09-10 found no repository or inherited rulesets for `master`; classic branch-protection required checks require authenticated inspection and are therefore unknown.

> Coverage policy: test execution and positive test-count evidence are mandatory. Coverage collection/import and low measured coverage are advisory. Missing or malformed coverage is reported as `UNKNOWN/UNAVAILABLE` and omitted from Sonar import; it never turns a failed test into success. The scanner does not wait for Sonar's native gate; `sonar-noncoverage-policy.mjs` waits for the submitted compute task, validates its exact analysis/revision, and accepts only `coverage` or `new_coverage` rejections. The native Sonar dashboard may remain red for coverage.

Run `npm run preflight:workflow` locally to execute the pinned workflow linter and Gateway helper fixtures with failure propagation. Sonar's evaluated server quality gate is hosted-only. A container smoke test blocked by an earlier required dependency is reported as blocked and does not count as success.

Every PR to `master` provides purpose, acceptance criteria, implementation summary, updated tests or verification evidence, compatibility/operational impact, and expected release impact. For non-trivial executable changes, retain `requirement -> acceptance criterion -> implementation -> test/evidence`. Template checkboxes support review but never waive automation.

`Gateway PR Verification` runs for opened, synchronized, reopened, ready-for-review, title-edited, and label-edited PR events. It calls `Gateway Common Quality` and checks out `github.sha`, GitHub's tested merge candidate; the PR policy summary records both PR head SHA and tested candidate SHA. It has no path exclusions. PR code runs under `pull_request` with `contents: read`, never `pull_request_target`.

The final required check is the GitHub Actions check named **Gateway PR Gate** (publisher: GitHub Actions; capture its observed integration ID at activation). It succeeds only when these jobs explicitly return `success`:

| Job ID | Evidence |
| --- | --- |
| `release-policy` | title/branch validation and policy fixtures |
| `common-quality` | reusable configuration, Release build/test/coverage, dependency security, actionlint/policy fixtures, and production container smoke tests |

The PR aggregate uses `always()` and explicitly requires both dependencies. The common-quality aggregate separately uses `always()` and explicitly requires configuration, build/test, security, workflow-policy, Docker verification, and Sonar policy evaluation. Failure, cancellation, unexpected skip, missing evidence, zero tests, scanner/upload failure, or a non-coverage Sonar rejection fails the required gate. `tools/ci/pr-gate.spec.mjs` and `tools/ci/sonar-noncoverage-policy.spec.mjs` cover fail-closed aggregate and Sonar decisions.

## Required GitHub enforcement

The intended `master` ruleset requires a PR, zero approvals, no Code Owner or last-pusher approval, all normal merge methods, up-to-date checks, `Gateway PR Gate` from the observed GitHub Actions publisher, no bypass actors, no force pushes, and no deletion. It does not introduce a merge queue. If authenticated inspection finds a separately required native Sonar check, replace that enforcement with the observed `Gateway PR Gate` only after a successful real run; otherwise a native coverage-only red result can still block merging.

Do not activate the required check until the workflow is pushed and a real successful `Gateway PR Gate` check emits. Then an administrator runs:

```powershell
pwsh -NoProfile -File tools/ci/configure-merge-protection.ps1 -Mode Inspect
pwsh -NoProfile -File tools/ci/configure-merge-protection.ps1 -Mode Apply
```

The helper snapshots effective inherited/repository rules and classic protection, refuses to overwrite a named ruleset, requires an observed publisher ID, creates only the Gateway ruleset, and reads effective rules back. A fresh PR then proves its current SHA requires the check. A local script is not live enforcement.
