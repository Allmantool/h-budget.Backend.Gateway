[CmdletBinding()]
param(
    [ValidateSet('Inspect', 'Enable', 'Disable')]
    [string]$Mode = 'Inspect',
    [string]$Repository = 'Allmantool/h-budget.Backend.Gateway'
)

$ErrorActionPreference = 'Stop'
$variableName = 'GATEWAY_PUBLICATION_ENABLED'

function Get-PublicationValue {
    $value = & gh variable get $variableName --repo $Repository 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }
    return $value.Trim()
}

function Show-CurrentState {
    $value = Get-PublicationValue
    $state = if ($value -eq 'true') { 'ENABLED' } else { 'HELD' }
    Write-Host "Repository: $Repository"
    Write-Host "Publication control: $state ($variableName=$($value ?? '<unset>'))"
    Write-Host 'Workflow states:'
    & gh workflow list --repo $Repository
    if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect workflow states.' }
    Write-Host 'Queued or in-progress executions:'
    & gh run list --repo $Repository --status queued --limit 100
    if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect queued executions.' }
    & gh run list --repo $Repository --status in_progress --limit 100
    if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect in-progress executions.' }
}

if ($Mode -eq 'Inspect') {
    Show-CurrentState
    return
}

$requestedValue = if ($Mode -eq 'Enable') { 'true' } else { 'false' }
& gh variable set $variableName --repo $Repository --body $requestedValue
if ($LASTEXITCODE -ne 0) { throw "Unable to set $variableName." }
Show-CurrentState
