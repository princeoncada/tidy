# observe.ps1 - Tidy AI harness opt-in local-memory hook.
#
# Opt-in and inactive by default. Appends a review-only learning candidate to
# the gitignored .tidy-ai/learning-queue.md. Never edits repo docs or source,
# never commits, never auto-promotes. Candidates become committed docs only via
# a normal user-approved phase.

param(
    [Parameter(Mandatory = $true)][string]$Note,
    [ValidateSet("observation", "learning", "risk")][string]$Category = "observation"
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$memDir = Join-Path $root ".tidy-ai"
if (-not (Test-Path $memDir)) {
    New-Item -ItemType Directory -Path $memDir | Out-Null
}

$queue = Join-Path $memDir "learning-queue.md"
if (-not (Test-Path $queue)) {
    $header = @(
        "# Learning Queue (local, review-only)",
        "",
        "Local scratch only. Entries are never auto-promoted and are never",
        "committed. They become committed docs only via a normal user-approved",
        "phase. See .claude/skills/tidy-skill-evolution/SKILL.md.",
        "",
        "## Candidates",
        ""
    )
    Set-Content -Path $queue -Value $header -Encoding utf8
}

$stamp = (Get-Date).ToUniversalTime().ToString("s") + "Z"
Add-Content -Path $queue -Value "- [$stamp] ($Category) $Note" -Encoding utf8

Write-Host "tidy-ai: appended a review-only candidate to .tidy-ai/learning-queue.md (local, gitignored)."
