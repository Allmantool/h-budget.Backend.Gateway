# Gateway CI/CD Release Contract

`master` is the sole stable release branch. A PR is fully verified before merge; a push to `master` repeats reusable verification before semantic-release decides whether a release is eligible. GitHub Releases are canonical release history and release tags match `vMAJOR.MINOR.PATCH`.

Semantic-release is the sole version calculator. `type!` and `BREAKING CHANGE:` produce MAJOR, `feat` produces MINOR, and `fix`, `perf`, `revert`, `refactor`, `chore`, `build`, and `ci` produce PATCH. `docs`, `test`, and `style` alone produce no release. Branch names and PR titles validate intent; they never calculate a version.

```text
verified master SHA -> explicit HELD/READY decision -> draft GitHub Release + immutable tag
-> exact image build/smoke -> version and SHA image tags -> remote digest readback
-> production Environment registry-publication record -> trace block -> published GitHub Release
```

The Docker image receives normalized SemVer and exact tag SHA as assembly metadata and OCI labels. The only published tags are `MAJOR.MINOR.PATCH` and `sha-<full-sha>`; no rolling alias is permitted. The GitHub Release stays draft while image publication is pending, so a tag or draft is not deployable evidence.

`GATEWAY_PUBLICATION_ENABLED` is the sole repository-level publication control. Anything other than the literal value `true` yields `HELD`: qualification can succeed, but the workflow must not create a tag, GitHub Release, Docker image, or Environment operation. A manual `Gateway Deployment` request fails its preflight while held.

Semantic-release writes its observed previous release and release identity through its supported lifecycle hooks; the workflow does not parse CLI prose or independently calculate a version. If no release-producing commits exist, semantic-release creates nothing. A partial image publication validates registry identity and copies the verified existing image to only the missing tag. It never moves a tag or overwrites conflicting bytes. An existing draft release for the current SHA is recovered with the same tag and SHA.

`production` currently represents the real Docker Hub registry-publication operation. It is not evidence of a running Gateway instance: no runtime deployment target or health-check script is configured in this repository.

PR workflows use read-only contents permission and never tag, publish, deploy, or alter repository settings. Sonar remains optional when its secret is unavailable and is outside the required merge-gate result set.
