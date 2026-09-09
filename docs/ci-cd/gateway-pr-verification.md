# Gateway PR Verification and Merge Protection

Every PR to `master` provides purpose, acceptance criteria, implementation summary, updated tests or verification evidence, compatibility/operational impact, and expected release impact. For non-trivial executable changes, retain `requirement -> acceptance criterion -> implementation -> test/evidence`. Template checkboxes support review but never waive automation.

`Gateway Verification` runs for opened, synchronized, reopened, ready-for-review, title-edited, and label-edited PR events. It checks out `github.sha`, GitHub's tested merge candidate; the PR policy summary records both PR head SHA and tested candidate SHA. It has no path exclusions. PR code runs under `pull_request` with `contents: read`, never `pull_request_target`.

The final required check is the GitHub Actions check named **Gateway PR Gate** (publisher: GitHub Actions; capture its observed integration ID at activation). It succeeds only when these jobs explicitly return `success`:

| Job ID | Evidence |
| --- | --- |
| `release-policy` | title/branch validation and policy fixtures |
| `validate-configuration` | JSON parsing and committed-configuration safety |
| `build-and-test` | restore, Release build, discovered test count, coverage |
| `security` | parsed transitive NuGet audit and npm release-toolchain audit |
| `workflow-policy` | pinned actionlint and executable policy tests |
| `docker-verify` | actual image, TLS, health, forwarding, invalid-config negative case |

The aggregate uses `always()` and an explicit expected job list. Failure, cancellation, unexpected skip, missing evidence, zero tests, or scanner/audit failure fails it. Optional Sonar does not participate. `tools/ci/pr-gate.spec.mjs` covers success, failure, skip, cancellation, missing, zero-test, and unavailable-security-service decisions.

## Required GitHub enforcement

The intended `master` ruleset requires a PR, zero approvals, no Code Owner or last-pusher approval, all normal merge methods, up-to-date checks, `Gateway PR Gate` from the observed GitHub Actions publisher, no bypass actors, no force pushes, and no deletion. It does not introduce a merge queue.

Do not activate the required check until the workflow is pushed and a real successful `Gateway PR Gate` check emits. Then an administrator runs:

```powershell
pwsh -NoProfile -File tools/ci/configure-merge-protection.ps1 -Mode Inspect
pwsh -NoProfile -File tools/ci/configure-merge-protection.ps1 -Mode Apply
```

The helper snapshots effective inherited/repository rules and classic protection, refuses to overwrite a named ruleset, requires an observed publisher ID, creates only the Gateway ruleset, and reads effective rules back. A fresh PR then proves its current SHA requires the check. A local script is not live enforcement.
