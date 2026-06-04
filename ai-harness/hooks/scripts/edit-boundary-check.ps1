# edit-boundary-check.ps1 - Tidy AI harness opt-in PreToolUse guardrail (Edit/Write).
#
# Opt-in, strict-profile only, inactive by default. Reads the Claude Code
# PreToolUse hook JSON from stdin and blocks (exit code 2) when the assistant
# tries to edit product source during a planning session: app, components, hooks,
# lib, trpc, prisma, or tests. Docs, .claude, ai-harness, and scripts are allowed.
# Never edits files. Fails open (exit 0) on empty or unparseable input.

$ErrorActionPreference = "Stop"

try {
    $raw = [Console]::In.ReadToEnd()
} catch {
    exit 0
}
if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }

try {
    $payload = $raw | ConvertFrom-Json
} catch {
    exit 0
}

$path = ""
if ($payload.tool_input -and $payload.tool_input.file_path) {
    $path = [string]$payload.tool_input.file_path
}
if ([string]::IsNullOrWhiteSpace($path)) { exit 0 }

$normalized = $path -replace '\\', '/'

# Never gate the harness's own surfaces.
if ($normalized -match '(?i)/ai-harness/' -or $normalized -match '(?i)/\.claude/') {
    exit 0
}

if ($normalized -match '(?i)(^|/)(app|components|hooks|lib|trpc|prisma|tests)/') {
    [Console]::Error.WriteLine("tidy edit-boundary: blocked edit to product source '$path'. Planning sessions do not edit product source; scope a Codex prompt instead.")
    exit 2
}

exit 0
