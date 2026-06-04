# session-checkpoint.ps1 - Tidy AI harness opt-in local-memory hook.
#
# Opt-in and inactive by default. Produces a LOCAL draft summary under the
# gitignored .tidy-ai/ path. It does NOT replace the committed SESSION_LOG
# checkpoint, never edits repo docs or source, never commits, and never
# auto-promotes learning candidates. The committed checkpoint still follows the
# Session Checkpoint Output Contract in docs/WORKFLOW.md.

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$memDir = Join-Path $root ".tidy-ai"
if (-not (Test-Path $memDir)) {
    New-Item -ItemType Directory -Path $memDir | Out-Null
}

$sessionLine = "No local session state found."
$statePath = Join-Path $memDir "session-state.json"
if (Test-Path $statePath) {
    $s = Get-Content $statePath -Raw | ConvertFrom-Json
    $sessionLine = "Session $($s.sessionId) started $($s.startedUtc) at version $($s.version)-$($s.state), phase $($s.phase)."
}

$candidateCount = 0
$queue = Join-Path $memDir "learning-queue.md"
if (Test-Path $queue) {
    $candidateCount = @(Get-Content $queue | Where-Object { $_ -match "^- \[" }).Count
}

$draft = @(
    "# Local Checkpoint Draft (not committed)",
    "",
    "DRAFT ONLY. This is local scratch under .tidy-ai/. It does not replace the",
    "committed SESSION_LOG checkpoint, which is produced via the Session Checkpoint",
    "Output Contract in docs/WORKFLOW.md. Learning candidates are promoted only",
    "through a normal user-approved phase.",
    "",
    "## Session",
    $sessionLine,
    "",
    "## Pending learning candidates",
    "Count: $candidateCount (see .tidy-ai/learning-queue.md)"
)

Set-Content -Path (Join-Path $memDir "checkpoint-draft.md") -Value $draft -Encoding utf8

Write-Host "tidy-ai: wrote local draft to .tidy-ai/checkpoint-draft.md. This is NOT the committed SESSION_LOG checkpoint."
