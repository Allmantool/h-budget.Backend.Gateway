# Gateway CI/CD Traceability

> Current traceability is the three-workflow chain: required PR gate; qualified master semantic tag/draft provenance; tag-triggered Docker Hub publication, `production` Environment record, and final release trace block. The previous `publication-report`/PR-comment entries below are historical and removed from the active workflow.

> Test execution is mandatory; coverage measurement/import is advisory and remains traceability evidence when available. The Gateway Sonar policy waits for the submitted server task and evaluates its exact analysis: only the verified `coverage` and `new_coverage` metrics are advisory, while every other rejected condition blocks.

| Requirement | Implementation | Evidence |
| --- | --- | --- |
| PR intent and release impact | PR template, `release-policy` | conventional title/branch and policy tests |
| Build and behavior | `build-and-test` | Release build, Gateway tests, positive TRX count, coverage |
| Source configuration safety | `validate-configuration` | JSON parser and `config-safety.mjs` |
| Dependency security | `security` | transitive NuGet JSON audit, policy parser, npm audit |
| Workflow automation | `workflow-policy` | pinned actionlint and Node fixtures |
| Actual container behavior | `docker-verify` | transient TLS, health, Ocelot forwarding, invalid TLS configuration |
| Sonar non-coverage policy | `sonar-noncoverage-policy.mjs` | exact compute task and analysis-ID gate response; PR source/base/current-SHA or branch analysis-revision correlation; structured gate response; coverage-only warning |
| Fail-closed merge decision | `Gateway PR Gate` | explicit expected results in `pr-gate.mjs` |
| Protected-master validation | `update_semver / verify` | reusable verification on resulting SHA |
| Automatic publication decision and version | `update_semver / publish` | semantic-release lifecycle observation, stable tag/SHA guards, initial draft source marker |
| Exact release artifact | `release-tag / build-image` | archive smoke-tested before publication |
| Publication/recovery | `release-tag / push-image` | version/SHA identity and remote digest convergence under `production` |
| Draft handoff and recovery | `release-tag / verify-release` and `release-resolver.mjs` | draft-name plus source-provenance discovery; explicit retryable and terminal diagnostics |
| Final delivery result | `release-tag / delivery-result` | release, registry, and Environment readback report |

Canonical local verification is the pinned .NET 10 SDK container in `dockerfile`; `global.json` selects SDK `10.0.300` with feature-band roll-forward. Use `npm ci --ignore-scripts && npm run test:release-policy`, the container .NET build/test commands, `tools/ci/container-smoke.sh`, and `pwsh tools/ci/configure-merge-protection.ps1 -Mode Inspect` for evidence.

The `production` record is a **registry publication**, not runtime deployment. The report always says “Published to Docker Hub” and includes the verified digest, source SHA, release/run links, and the Environment activity link. The `v0.1.2` fixture records the observed release `385577746`, source `ce1b639ae97b0c6e1635e76f0c81d533b09b1f25`, digest `sha256:2e483e847eac37afe1133a8b0c762cdbb99cb62dd259dfc5a422fce7d230e182`, and publication run `34361835433`; it is a local metadata preview, not a retrospective remote edit.
