# Home Ledger CI/CD Audit — Gateway Alignment

Audit date: 2026-09-09. SPA (`UI`) and Accounting (`Api/HomeBudget-Accounting-Api`) were read-only references. Gateway is the only implementation target.

| Area | SPA evidence | Accounting evidence | Gateway status after this change |
| --- | --- | --- | --- |
| Stable branch and semantic release | `UI/.github/workflows/merge-pr.yml`, `UI/AGENTS.md` | `Api/HomeBudget-Accounting-Api/.github/workflows/update_semver.yml` | IMPLEMENTED: `master`, semantic-release-only `vMAJOR.MINOR.PATCH` |
| PR metadata policy | `UI/.github/workflows/pr-release-policy.yml` | `Api/HomeBudget-Accounting-Api/.github/workflows/pr-release-policy.yml` | IMPLEMENTED: integrated `release-policy` job in Gateway Verification |
| PR build/test verification | `UI/.github/workflows/build.yml` | `Api/HomeBudget-Accounting-Api/.github/workflows/ci-master.yml` | IMPLEMENTED locally: release build, existing gateway tests, configuration, security, workflow, image/smoke jobs |
| Final aggregate PR check | workflow evidence inspected; live enforcement not inferred | workflow evidence inspected; live enforcement not inferred | IMPLEMENTED BUT NOT ENFORCED: `Gateway PR Gate` is fail-closed in YAML |
| Current GitHub protection | not asserted without live settings evidence | not asserted without live settings evidence | NOT PRESENT live: 2026-09-09 API inspection returned no `master` classic protection, no effective rulesets, and no emitted Gate check |
| Image identity | SPA deployment workflow versions and SHA tags | Accounting release-tag workflow | IMPLEMENTED: SemVer + full SHA tags only, labels and digest verification |
| Release recovery | operational workflow references | operational workflow references | IMPLEMENTED locally: draft-release state, partial-tag convergence, recovery fixtures |

The reference repositories demonstrate workflow conventions but do not prove their current effective GitHub settings in this audit. Gateway's required-check publisher and enforcement remain pending until the workflow is pushed and emits a real check. See `gateway-pr-verification.md` for the activation sequence.
