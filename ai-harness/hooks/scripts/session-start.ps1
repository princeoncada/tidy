# session-start.ps1 - Tidy AI harness opt-in local-memory hook.
#
# Opt-in and inactive by default (hooks.template.json keeps it disabled).
# Writes ONLY under the gitignored .tidy-ai/ path. Never edits repo docs or
# source, never commits, never runs validation, never auto-promotes anything.

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$memDir = Join-Path $root ".tidy-ai"
if (-not (Test-Path $memDir)) {
    New-Item -ItemType Directory -Path $memDir | Out-Null
}

$version = ""
$state = ""
$phase = ""
$nextPhase = ""
$statePath = Join-Path $root "STATE.json"
if (Test-Path $statePath) {
    $stateJson = Get-Content $statePath -Raw | ConvertFrom-Json
    $version = $stateJson.version
    $state = $stateJson.state
    $phase = $stateJson.phase
    $nextPhase = $stateJson.nextPhase
}

$sessionState = [ordered]@{
    sessionId  = (Get-Date -Format "yyyyMMdd-HHmmss")
    startedUtc = (Get-Date).ToUniversalTime().ToString("s") + "Z"
    version    = $version
    state      = $state
    phase      = $phase
    nextPhase  = $nextPhase
}

$sessionState | ConvertTo-Json | Set-Content -Path (Join-Path $memDir "session-state.json") -Encoding utf8

Write-Host "tidy-ai: session state written to .tidy-ai/session-state.json (local, gitignored)."
