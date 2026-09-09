[CmdletBinding()]
param(
    [ValidateSet('Inspect', 'Apply')]
    [string]$Mode = 'Inspect',
    [string]$Repository = 'Allmantool/h-budget.Backend.Gateway'
)

$ErrorActionPreference = 'Stop'
$rulesetName = 'Gateway master mandatory PR verification'

function Get-GhJson([string]$Endpoint) {
    $output = & gh api $Endpoint
    if ($LASTEXITCODE -ne 0) { throw "GitHub API request failed: $Endpoint" }
    return $output | ConvertFrom-Json
}

Write-Host "Repository: $Repository"
Write-Host 'Effective rules for master:'
Get-GhJson "repos/$Repository/rules/branches/master" | ConvertTo-Json -Depth 20
Write-Host 'Repository and inherited rulesets:'
$rulesets = Get-GhJson "repos/$Repository/rulesets?includes_parents=true"
$rulesets | ConvertTo-Json -Depth 20

try {
    Write-Host 'Classic branch protection:'
    Get-GhJson "repos/$Repository/branches/master/protection" | ConvertTo-Json -Depth 20
} catch {
    Write-Host 'No classic master branch-protection object is configured.'
}

$checkRuns = Get-GhJson "repos/$Repository/commits/master/check-runs?per_page=100"
$gate = @($checkRuns.check_runs | Where-Object { $_.name -eq 'Gateway PR Gate' } | Select-Object -First 1)
if ($Mode -eq 'Inspect') {
    if ($gate.Count -eq 0) {
        Write-Host 'Gateway PR Gate has not emitted a check run on master. Do not activate a required check yet.'
    } else {
        Write-Host "Observed Gateway PR Gate publisher integration id: $($gate[0].app.id)"
    }
    return
}

if ($gate.Count -ne 1 -or -not $gate[0].app.id) {
    throw 'Refusing to apply protection: first push the workflow, observe a successful Gateway PR Gate check run, then rerun this script.'
}

if (@($rulesets | Where-Object { $_.name -eq $rulesetName }).Count -gt 0) {
    throw "A ruleset named '$rulesetName' already exists. Inspect and deliberately update it; this script will not overwrite protections."
}

$payload = [ordered]@{
    name = $rulesetName
    target = 'branch'
    enforcement = 'active'
    bypass_actors = @()
    conditions = @{ ref_name = @{ include = @('refs/heads/master'); exclude = @() } }
    rules = @(
        @{ type = 'deletion' },
        @{ type = 'non_fast_forward' },
        @{ type = 'pull_request'; parameters = @{
            allowed_merge_methods = @('merge', 'squash', 'rebase')
            dismiss_stale_reviews_on_push = $false
            require_code_owner_review = $false
            require_last_push_approval = $false
            required_approving_review_count = 0
            required_review_thread_resolution = $false
        } },
        @{ type = 'required_status_checks'; parameters = @{
            do_not_enforce_on_create = $false
            strict_required_status_checks_policy = $true
            required_status_checks = @(@{ context = 'Gateway PR Gate'; integration_id = $gate[0].app.id })
        } }
    )
}

$payloadFile = Join-Path ([System.IO.Path]::GetTempPath()) "gateway-ruleset-$([guid]::NewGuid().ToString('N')).json"
try {
    $payload | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $payloadFile -NoNewline
    & gh api --method POST "repos/$Repository/rulesets" --input $payloadFile
    if ($LASTEXITCODE -ne 0) { throw 'GitHub rejected the ruleset payload.' }
    Write-Host 'Ruleset created. Read back the effective rules and verify a fresh PR requires Gateway PR Gate before merging.'
    Get-GhJson "repos/$Repository/rules/branches/master" | ConvertTo-Json -Depth 20
} finally {
    Remove-Item -LiteralPath $payloadFile -Force -ErrorAction SilentlyContinue
}
