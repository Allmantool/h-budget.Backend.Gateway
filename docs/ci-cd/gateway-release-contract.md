# Gateway CI/CD Release Contract

> Current architecture (superseding the historical flow below): `Gateway PR Verification` -> required `Gateway PR Gate`; `Gateway Build & Release — master` -> semantic-release tag plus draft source metadata; `Gateway Deploy vX.Y.Z` -> tag-push deployment. Sonar scan/upload and exact non-coverage policy evaluation are mandatory; native coverage-only gate rejections are advisory and remain visible in Sonar. Build/release never invokes the deployment workflow. Deployment verifies the qualified master source/check and release provenance, retries metadata availability for 60 seconds, publishes only immutable version/SHA Docker tags under `production`, then finalizes the release. `GH_PAT` authenticates tag creation because `GITHUB_TOKEN` tag events do not trigger the separate deployment workflow. Manual dispatch is recovery of an existing tag only; there are no PR comments or other publication notification jobs.

> Coverage collection, validation, and scanner import are required in both PR and master common quality. Only measured Sonar coverage gate conditions remain advisory; required test execution, Sonar's exact-analysis non-coverage conditions, security, configuration, workflow policy, and Docker verification remain release prerequisites.

`master` is the sole stable release branch. A PR is fully verified before merge; a push to `master` repeats reusable verification before semantic-release decides whether a release is eligible. GitHub Releases are canonical release history and release tags match `vMAJOR.MINOR.PATCH`.

Semantic-release is the sole version calculator. `type!` and `BREAKING CHANGE:` produce MAJOR, `feat` produces MINOR, and `fix`, `perf`, `revert`, `refactor`, `chore`, `build`, and `ci` produce PATCH. `docs`, `test`, and `style` alone produce no release. Branch names and PR titles validate intent; they never calculate a version.

```text
verified master SHA -> semantic-release analysis -> draft GitHub Release + immutable tag
-> exact image build/smoke -> version and SHA image tags -> remote digest readback
-> production Environment registry-publication record -> trace block -> published GitHub Release
```

The Docker image receives normalized SemVer and exact tag SHA as assembly metadata and OCI labels. The only published tags are `MAJOR.MINOR.PATCH` and `sha-<full-sha>`; no rolling alias is permitted. The GitHub Release stays draft while image publication is pending, so a tag or draft is not deployable evidence.

There is no publication-enable variable, label, approval, or manual activation step. After common quality succeeds for the resulting `master` SHA, semantic-release always analyzes the actual range. A no-release decision means that range contains no release-producing commits; any version identity proceeds directly to immutable publication. GitHub and Docker Hub credentials authenticate trusted publication jobs only. Missing or invalid credentials fail publication; they never produce a successful skipped delivery.

Semantic-release writes its observed previous release and release identity through its supported lifecycle hooks; the workflow does not parse CLI prose or independently calculate a version. The locked GitHub plugin's `releaseBodyTemplate` writes the source marker in the initial draft body, before the tag-triggered deployment can observe it. GitHub draft records carry an opaque `untagged-*` API `tag_name`, so discovery matches the stable release name and qualified source marker; published releases must match the immutable tag. If no release-producing commits exist, semantic-release creates nothing. A partial image publication validates registry identity and copies the verified existing image to only the missing tag. It never moves a tag or overwrites conflicting bytes. An existing draft release for the current SHA is recovered with the same tag and SHA.

`production` currently represents the real Docker Hub registry-publication operation. It is not evidence of a running Gateway instance: no runtime deployment target or health-check script is configured in this repository.

PR workflows use read-only contents permission and never tag, publish, deploy, or alter repository settings. Sonar credentials, scan/upload, compute-task processing, and non-coverage evaluation are required; their failure is never treated as optional.
