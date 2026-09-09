# Gateway CI/CD Traceability

| Requirement | Implementation | Evidence |
| --- | --- | --- |
| PR intent and release impact | PR template, `release-policy` | conventional title/branch and policy tests |
| Build and behavior | `build-and-test` | Release build, Gateway tests, positive TRX count, coverage |
| Source configuration safety | `validate-configuration` | JSON parser and `config-safety.mjs` |
| Dependency security | `security` | transitive NuGet JSON audit, policy parser, npm audit |
| Workflow automation | `workflow-policy` | pinned actionlint and Node fixtures |
| Actual container behavior | `docker-verify` | transient TLS, health, Ocelot forwarding, invalid TLS configuration |
| Fail-closed merge decision | `Gateway PR Gate` | explicit expected results in `pr-gate.mjs` |
| Protected-master validation | `update_semver / verify` | reusable verification on resulting SHA |
| Automatic publication decision and version | `update_semver / publish` | semantic-release lifecycle observation, stable tag/SHA guards, draft Release |
| Exact release artifact | `release-tag / build-image` | archive smoke-tested before publication |
| Publication/recovery | `release-tag / push-image` | version/SHA identity and remote digest convergence under `production` |
| Final delivery result | `update_semver / deliver, delivery-result` and `release-tag / delivery-result` | direct reusable handoff; release, registry, and Environment readback report |

Canonical local verification is the pinned .NET 10 SDK container in `dockerfile`; `global.json` selects SDK `10.0.300` with feature-band roll-forward. Use `npm ci --ignore-scripts && npm run test:release-policy`, the container .NET build/test commands, `tools/ci/container-smoke.sh`, and `pwsh tools/ci/configure-merge-protection.ps1 -Mode Inspect` for evidence.
