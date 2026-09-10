$ErrorActionPreference = 'Stop'

& npm run test:release-policy
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& docker run --rm -v "$($PWD.Path):/repo" -w /repo rhysd/actionlint@sha256:887a259a5a534f3c4f36cb02dca341673c6089431057242cdc931e9f133147e9
exit $LASTEXITCODE
