# Gateway Sonar coverage regression — 2026-09-10; remediation 2026-09-11

## Executive conclusion

**CONFIRMED ROOT CAUSE:** commit `dce5ea3d07eded602b24eab9e3ccba214bcc4f21`
(`2026-09-10 11:29:03 +03:00`) made the coverage-import handoff conditional
on `command -v xmllint`. The GitHub-hosted run generated, uploaded, and
downloaded a valid Visual Studio coverage XML report, but the guard wrote an
empty `COVERAGE_FILE`. `startsonar.sh` consequently omitted
`sonar.cs.vscoveragexml.reportsPaths`, so Sonar processed the analysis with no
coverage input and published 0% coverage on `master`.

This is an **import handoff** regression, not a test-execution, report-
generation, upload, or server-processing failure. The master analysis did run:
`Gateway Build & Release` calls the reusable quality workflow on every master
push. The current Sonar master measure is 0.0% (848 lines to cover), which is
the expected dashboard result for that no-report analysis.

Confidence: high. The one detail inferred rather than printed by the runner is
the failed predicate within the silent `if`: the downloaded report is nonempty
and well-formed, leaving unavailable `xmllint` as the only predicate that can
make the condition false.

## Evidence and regression timeline

All GitHub timestamps below are UTC; commit timestamps include `+03:00` where
recorded by Git. Run URLs are retained as stable evidence references.

| Point | Run / revision | Result and coverage evidence |
| --- | --- | --- |
| Last confirmed master coverage import | [34446456557](https://github.com/Allmantool/h-budget.Backend.Gateway/actions/runs/34446456557), 2026-09-10 06:42:59Z; `cd05ed5` | Tests and coverage collection succeeded. Sonar parsed `test-results/backend-gateway-coverage.xml` as Visual Studio XML: 31 files, 26 main files, all 26 with coverage, and 5 test files. It uploaded an analysis for `master`. Its native gate failed on coverage (see below), so the release workflow failed; this is still a healthy import baseline. |
| First affected master analysis | [34455478829](https://github.com/Allmantool/h-budget.Backend.Gateway/actions/runs/34455478829), 2026-09-10 08:29:54Z; `a9051d2` | First master run after `dce5ea3` entered `Prepare advisory coverage import`. Coverage collection succeeded, but the Sonar-job environment shows `COVERAGE_FILE:` empty. The analysis completed successfully for `master`. |
| Latest relevant master analysis | [34505872881](https://github.com/Allmantool/h-budget.Backend.Gateway/actions/runs/34505872881), 2026-09-10 17:03:35Z; `71f08d5` | Build/test and coverage collection succeeded; artifact `gateway-test-results-34505872881` contains a 1,286,325-byte report with 168 `<source_file>` entries. The Sonar job again had `COVERAGE_FILE:` empty, uploaded successfully, and Sonar processed revision `71f08d5` as `master`. |
| Relevant old PR routing failure | [34387708245](https://github.com/Allmantool/h-budget.Backend.Gateway/actions/runs/34387708245), PR [392](https://github.com/Allmantool/h-budget.Backend.Gateway/pull/392), 2026-09-09 18:13:35Z; `f4d5c91` | Report import succeeded and the analysis was uploaded, but it was routed to short branch `392/merge`, not a PR. Its native gate failed solely on `new_coverage = 0.0 < 80`. |
| Later correct PR routing, separate from main | [34505666114](https://github.com/Allmantool/h-budget.Backend.Gateway/actions/runs/34505666114), PR 397, 2026-09-10 17:01:33Z; `ae61e1e` | The scanner selected the PR head and the evaluator confirmed processing of PR 397. It also had an empty `COVERAGE_FILE`, so correct PR routing did not restore coverage import. |

The public Sonar branch API confirmed the current `master` analysis at
2026-09-10 17:05:34Z, revision `71f08d5`, and public measures confirmed 0.0%
overall and new coverage. Thus this is not a stale dashboard or an analysis
uploaded to a different project.

## Pipeline boundary trace

| Boundary | Pre-guard baseline (run 34446456557) | Affected/latest master (runs 34455478829 / 34505872881) | Status |
| --- | --- | --- | --- |
| Trigger and routing | `update_semver.yml` runs on `push` to `master` and invokes `ci-common.yml`. | Same. The latest Sonar log says `ANALYSIS SUCCESSFUL` for `branch=master`, revision `71f08d5`. | Passed |
| Tests | Gateway tests completed in CI; local isolated reproduction: 7 passed, 0 failed, 0 skipped. | CI `Run mandatory Gateway tests` succeeded. | Passed |
| Generation | `dotnet-coverage 18.4.1` produced Visual Studio XML. | CI coverage step succeeded; downloaded latest artifact is nonempty and XML-well-formed. | Passed |
| Transport | Report was available to the Sonar job. | Artifact download succeeded; the exact report was downloaded from the latest run. | Passed |
| Import handoff | Scanner was given `sonar.cs.vscoveragexml.reportsPaths`; it parsed the report and recorded 26 covered main files. | `Prepare advisory coverage import` set `COVERAGE_FILE=`. `startsonar.sh` therefore deliberately did not provide the report property. | **Failed** |
| Upload and processing | Report uploaded, then native gate evaluated. | Report uploaded; server processing succeeded; exact master revision verified by logs/API. | Passed |
| Dashboard | Coverage was imported. | 0.0% coverage for the intended master analysis, because it had no coverage input. | Expected consequence |

The effective handoff is in
`.github/workflows/ci-common.yml:209-220`; scanner argument construction is in
`startsonar.sh:57-66` and `startsonar.sh:83-92`.

## Confirmed causal chain

```text
dce5ea3 adds `command -v xmllint && ... && xmllint --noout`
  -> hosted Sonar job cannot satisfy that silent guard
  -> workflow writes COVERAGE_FILE= despite a valid downloaded XML artifact
  -> startsonar.sh omits sonar.cs.vscoveragexml.reportsPaths
  -> scanner uploads/processes a master analysis without coverage data
  -> Sonar displays 0.0% coverage for that exact master revision
```

The change was intended to preserve advisory coverage behavior. It became
incorrect because validation-tool availability was treated as evidence that the
generated report was unavailable, and no diagnostic identifies the failed
predicate. `dce5ea3` is therefore the root cause; the silent, compound guard is
the contributing design flaw.

### `392/merge` is related, but not the current root cause

PR 392's `ci-common.yml:185-193` passed no `PULL_REQUEST_*` values to
`startsonar.sh`. The script fell through to its non-PR branch logic with
GitHub's synthetic `392/merge` ref. Its log proves the report was parsed,
uploaded, and processed. The Sonar API shows exactly one failed gate condition:
`new_coverage` 0.0 against threshold 80; it did concern coverage.

Commit `14878a2` later passed PR identity values, and current
`.github/workflows/ci-common.yml:229-253` checks out the PR head and validates
the submitted analysis identity. This repaired routing but not the later
coverage-handoff regression. Do not route PR analyses to `master`.

## Sibling comparison

| Area | Gateway | Accounting | SPA | Relevant? |
| --- | --- | --- | --- | --- |
| Master execution | `update_semver.yml:4-22` pushes master into reusable quality/Sonar work. | Separate accounting quality workflow/contract. | `merge-pr.yml:3-82` tests and scans on master push. | Yes: Gateway does have a master path, ruling out a missing-trigger explanation. |
| Coverage format | `dotnet-coverage` Visual Studio XML; `sonar.cs.vscoveragexml.reportsPaths`. | Coverlet emits OpenCover/Cobertura; scanner uses `sonar.cs.opencover.reportsPaths`. | Karma LCOV; `sonar.javascript.lcov.reportPaths`. | Yes: formats/property names differ correctly; copying a sibling setup would be wrong. |
| Report verification | Current Gateway depends on `xmllint` before setting the scanner input. | Merges validated OpenCover inputs and checks local paths. | Scanner receives the LCOV path from properties. | Yes: Gateway alone drops a good report based on an unavailable validation executable. |
| Latest accessible evidence | Latest master run generated the coverage artifact but skipped import. | Recent PR verification run [34512333001](https://github.com/Allmantool/h-budget.HomeBudget.AccountingApi/actions/runs/34512333001) succeeded; repository configuration retains its separate OpenCover path. | Public Sonar measure reports 79.5% overall coverage. | Comparison control only; no identical scanner/credential contract is assumed. |

## Minimal remediation — NOT APPLIED

Replace the silent `xmllint` dependency with a validator supplied by the
GitHub-hosted Ubuntu image, while retaining the current advisory behavior and
making the reason observable. This does not alter test scope, quality thresholds,
release sequencing, or Sonar identities.

```diff
--- a/.github/workflows/ci-common.yml
+++ b/.github/workflows/ci-common.yml
@@
-          if command -v xmllint >/dev/null 2>&1 && [[ -s "$coverage_report" ]] && xmllint --noout "$coverage_report"; then
+          if [[ -s "$coverage_report" ]] && python3 -c 'import sys; import xml.etree.ElementTree as ET; ET.parse(sys.argv[1])' "$coverage_report"; then
             echo "COVERAGE_FILE=$coverage_report" >> "$GITHUB_ENV"
             echo 'Coverage: available for Sonar import (advisory).' >> "$GITHUB_STEP_SUMMARY"
           else
             echo 'COVERAGE_FILE=' >> "$GITHUB_ENV"
```

This is the smallest change that restores the already-generated report to the
scanner while preserving malformed-report suppression. Before applying it,
confirm `python3 --version` in one hosted-run log or replace it with another
explicitly provisioned XML validator. Regression risk is low: Python parses the
same XML well-formedness property, and the scanner remains the authoritative
format importer. Rollback is a one-line reversion.

Add a narrowly scoped regression check: after the guard, emit only the safe
state (`available`, `missing`, `malformed`, or `validator-unavailable`), and
make a workflow fixture assert that a valid report sets `COVERAGE_FILE`. Do not
assert an arbitrary coverage percentage.

## Validation performed

* `git remote -v`, `git log`, exact workflow diffs, and blame: confirmed the
  active repository and commits above. Existing local
  `HomeBudget.Backend.Gateway/appsettings.json` changes were preserved.
* GitHub Actions read-only API/log inspection: correlated run IDs, job steps,
  artifacts, SHAs, scanner import logs, uploads, and processing outcomes.
* SonarCloud read-only APIs: verified branch/revision identities, current
  master measure, and the exact PR 392 gate condition.
* Isolated temporary worktree at `71f08d5`, .NET SDK 10.0.401:
  `dotnet restore`, Release build (0 errors; 42 existing warnings), tests
  (7/7 passed), and `dotnet-coverage 18.4.1` collection. Generated report:
  1,294,440 bytes, root `results`, 168 `<source_file>` elements.
* `node --test tools/ci/sonar-noncoverage-policy.spec.mjs`: 29 passed.
  `node --test tools/ci/coverage-policy.spec.mjs tools/ci/pr-gate.spec.mjs`:
  16 passed.

This was the state of the audit before the implementation update below. No
remote workflow, Sonar setting, release configuration, or production analysis
has been changed by the remediation work. No end-to-end restoration claim is
made.

## Remaining unknowns and post-fix proof

The runner log does not print which term of the old compound guard failed; the
valid downloaded XML rules out the file and syntax terms, so absent `xmllint` is
the remaining explanation. Sonar binding/automatic-analysis metadata was not
available through the public API, but it is not needed for this causal chain.

After applying the proposed change, use one ordinary master merge and one PR;
do not dispatch an experimental production scan. For each, confirm in that
run's logs that the report is nonempty, `COVERAGE_FILE` contains the report
path, the scanner logs Visual Studio XML parsing and covered main-file counts,
and `report-task.txt`/the evaluator identifies the intended revision and
`master` or PR identity. Then use Sonar's compute-task and measures APIs to
confirm the processed analysis shows coverage for that same revision.

## Direct answers

* **Where does Gateway fail?** At report-import handoff. It generates,
  transports, uploads, and processes analyses, but current runs intentionally
  omit the report from the scanner.
* **What changed after September 9?** The decisive regression change is
  `dce5ea3` on September 10: an unavailable `xmllint` guard began blanking
  `COVERAGE_FILE`. The earlier September 9 refactor also created PR-routing
  defects, later fixed, but did not cause the present master import failure.
* **Is `392/merge` related?** Yes: it proves the earlier PR was misrouted and
  that coverage import/upload did work. It is not the current master root
  cause.
* **Did the observed gate failure concern coverage?** Yes. PR 392 failed only
  `new_coverage` (0.0 < 80).
* **Why do Accounting and SPA continue to work?** They use different,
  functioning coverage formats/handoffs and do not use Gateway's `xmllint`
  gate. Their success does not prove identical credentials or settings.
* **Smallest justified fix?** Replace the unprovisioned silent validator with a
  guaranteed validator and retain the advisory malformed-report path; patch
  above is NOT APPLIED.
* **What is verified?** The exact Gateway runs, generated/downloaded XML,
  omitted scanner property, uploaded/processed master analysis, 0% dashboard
  result, PR 392 routing/gate facts, and local generation. Server binding
  metadata and post-fix end-to-end restoration remain unverified.

## Implementation update — 2026-09-11

The repository now treats the Visual Studio coverage report as a required
contract rather than advisory evidence. `.github/workflows/ci-common.yml`
removes the coverage collector's `continue-on-error`, installs the actual
`xmllint` provider (`libxml2-utils`) in the consuming Sonar job, and calls
`tools/ci/validate-coverage-report.sh` after artifact download. The helper
fails distinctly for missing, empty, malformed, incompatible, and unavailable
validator states; only a valid Visual Studio report writes `COVERAGE_FILE`.
`startsonar.sh` rejects an absent or empty handoff and always emits the exact
`sonar.cs.vscoveragexml.reportsPaths` argument after validation.

| Acceptance criterion | Implemented evidence |
| --- | --- |
| COV-01: validated report is propagated to Sonar | `validate-coverage-report.sh` exports only the validated path; `startsonar.sh` unconditionally supplies the Visual Studio property. |
| COV-02: invalid report fails before scan | Required collection no longer continues on error; validation uses nonzero, classified failures and the scanner rejects no handoff. |
| COV-03: validator availability is explicit | The workflow installs `libxml2-utils`; `COV_REPORT_VALIDATOR_UNAVAILABLE` remains a distinct failure if the environment is wrong. |
| COV-04: zero coverage is valid input | Validation checks XML shape and required module attributes, not percentage, file, or line-count thresholds. |
| COV-05: trusted and untrusted routing is unchanged | No event, permission, checkout, PR identity, branch-routing, or Sonar evaluator logic changed. The existing untrusted restrictions remain in force. |
| COV-06: scope is limited | Only coverage collection/handoff, focused tests/fixtures, and their direct documentation/policy assertions changed. |

### Red/green and local implementation evidence

* **Red:** before this change, `node --test tools/ci/coverage-policy.spec.mjs`
  failed the new missing-report regression because `startsonar.sh` returned
  success and invoked the scanner without a coverage argument.
* **Green:** `node --test tools/ci/coverage-policy.spec.mjs
  tools/ci/coverage-report-validation.spec.mjs` passes 9/9. The new focused
  suite covers valid current-format XML, the original valid fixture, missing,
  empty, malformed, incompatible, validator-unavailable, zero-covered,
  whitespace-path, and scanner-argument propagation paths.
* **Actual collector and validator:** Release build completed with 0 errors
  (42 pre-existing warnings), Gateway tests passed 7/7, and
  `dotnet-coverage 18.4.1` generated a 1,293,748-byte report. In an
  Ubuntu 24.04 container, installing `libxml2-utils` and invoking the helper
  produced `COV_REPORT_VALID`, found 3 modules, and exported
  `COVERAGE_FILE=test-results/backend-gateway-coverage.xml`.
* **Exact historical mechanism:** local `xmllint` is unavailable; a literal
  reproduction of the old compound guard with that generated valid report
  returned `HISTORICAL_GUARD=EMPTY_COVERAGE_FILE`. This confirms the previously
  inferred predicate without relying on a summary alone.

### Required remote proof and rollback

Do not call the dashboard restored until an ordinary master merge completes.
For that run, retain the run URL, SHA, coverage artifact size, validation log,
`COV_REPORT_SCANNER_ARGUMENT` log, scanner Visual Studio import summary, and
the compute-task/branch API evidence that the same `master` revision has
nonzero imported coverage. A normal PR should additionally prove its existing
PR identity path; no manual production scan or workflow dispatch is needed.

If the change causes an operational failure, revert only the coverage-contract
commit and investigate the explicit `COV_REPORT_*` reason. Do not restore the
former empty-variable/coverage-less scan behavior as a workaround.
