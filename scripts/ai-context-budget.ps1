# ai-context-budget.ps1 - Tidy AI context budget audit.
#
# On-demand only. Estimates the approximate token cost of the AI workflow
# surface (AGENTS.md, CLAUDE.md, the core docs, and ai-harness/**), grouped by
# how often each file loads, so docs-led context bloat can be spotted before it
# creeps back. Requires no external service and no vector DB, and is never part
# of session startup. It reads files only; it never edits, commits, or validates.
#
# Token estimate heuristic: characters / 4 (a rough average, not a tokenizer).

param(
    [int]$TopN = 5,
    [int]$StartupBudget = 8000
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Get-TokenEstimate([string]$fullPath) {
    if (-not (Test-Path $fullPath)) { return $null }
    $raw = Get-Content -Path $fullPath -Raw -Encoding UTF8
    if ($null -eq $raw) { return 0 }
    return [math]::Ceiling($raw.Length / 4)
}

function Measure-Bucket([string]$bucketName, [string[]]$relPaths) {
    $rows = @()
    foreach ($rel in ($relPaths | Select-Object -Unique)) {
        $est = Get-TokenEstimate (Join-Path $root $rel)
        if ($null -eq $est) {
            Write-Host ("  [skip] {0} (not found)" -f $rel) -ForegroundColor DarkGray
            continue
        }
        $rows += [pscustomobject]@{ Bucket = $bucketName; File = $rel; Tokens = $est }
    }
    return , $rows
}

function Show-Rows([string]$title, $rows, [int]$budget) {
    $total = ($rows | Measure-Object -Property Tokens -Sum).Sum
    if ($null -eq $total) { $total = 0 }
    Write-Host ("-- {0} --" -f $title) -ForegroundColor Yellow
    foreach ($r in ($rows | Sort-Object Tokens -Descending)) {
        Write-Host ("  {0,9:N0}  {1}" -f $r.Tokens, $r.File)
    }
    if ($budget -gt 0) {
        $status = "within budget"; $color = "Green"
        if ($total -gt $budget) { $status = "OVER budget"; $color = "Red" }
        Write-Host ("  Subtotal: {0:N0} tokens (target < {1:N0}: {2})" -f $total, $budget, $status) -ForegroundColor $color
    }
    else {
        Write-Host ("  Subtotal: {0:N0} tokens" -f $total) -ForegroundColor Gray
    }
    Write-Host ""
    return $total
}

$startupDocs = @(
    "STATE.json",
    "docs/FUTURE_PLANS.md",
    "AGENTS.md",
    "CLAUDE.md"
)

$orientation = @(
    "codebase-graph.json"
)

$taskRouted = @(
    "docs/AI_HANDOFF.md",
    "docs/CODEX_RULES.md",
    "docs/WORKFLOW.md",
    "docs/CONTEXT_INDEX.md",
    "docs/VERSIONING.md",
    "docs/COMPACT_STRATEGY.md"
)

$optional = @(
    "docs/PHASE_LOG.md",
    "docs/SESSION_LOG.md",
    "docs/DECISIONS.md",
    "docs/NEW_CHATHEAD_OPENER.md"
)

$sessionLogDir = Join-Path $root "docs/SESSION_LOG"
if (Test-Path $sessionLogDir) {
    Get-ChildItem -Path $sessionLogDir -Recurse -File |
        Where-Object { $_.Extension -eq ".md" } |
        ForEach-Object { $optional += $_.FullName.Substring($root.Length + 1).Replace("\", "/") }
}

$harnessDir = Join-Path $root "ai-harness"
if (Test-Path $harnessDir) {
    Get-ChildItem -Path $harnessDir -Recurse -File |
        Where-Object { $_.Extension -in ".md", ".json", ".ps1" } |
        ForEach-Object { $optional += $_.FullName.Substring($root.Length + 1).Replace("\", "/") }
}

Write-Host ""
Write-Host "=== Tidy AI Context Budget ===" -ForegroundColor Cyan
Write-Host "Heuristic: characters / 4 (relative signal, not an exact tokenizer)."
Write-Host ("Root: {0}" -f $root)
Write-Host ""

$startupRows = Measure-Bucket "startup" $startupDocs
$orientationRows = Measure-Bucket "orientation" $orientation
$taskRows = Measure-Bucket "task" $taskRouted
$optionalRows = Measure-Bucket "optional" $optional

$startupTotal = Show-Rows "Startup docs (loaded every session)" $startupRows $StartupBudget
$orientationTotal = Show-Rows "Orientation artifact (read selectively at startup; full size overstates real cost)" $orientationRows 0
$taskTotal = Show-Rows "Task-routed docs (loaded during scoping or implementation)" $taskRows 0
$optionalTotal = Show-Rows "Optional/historical (cost nothing until read)" $optionalRows 0

$grand = $startupTotal + $orientationTotal + $taskTotal + $optionalTotal
Write-Host ("Grand total across listed surface: {0:N0} tokens" -f $grand) -ForegroundColor Cyan
Write-Host ""

$allRows = @($startupRows) + @($orientationRows) + @($taskRows) + @($optionalRows)
Write-Host ("-- Top {0} bloat sources (all buckets) --" -f $TopN) -ForegroundColor Yellow
foreach ($r in ($allRows | Sort-Object Tokens -Descending | Select-Object -First $TopN)) {
    Write-Host ("  {0,9:N0}  [{1}] {2}" -f $r.Tokens, $r.Bucket, $r.File)
}
Write-Host ""
Write-Host "Trim guidance: reduce Startup docs first (they load every session)," -ForegroundColor Gray
Write-Host "then large Task-routed docs. Optional/historical files cost nothing until read." -ForegroundColor Gray
