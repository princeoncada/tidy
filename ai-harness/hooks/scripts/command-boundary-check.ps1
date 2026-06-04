# command-boundary-check.ps1 - Tidy AI harness opt-in PreToolUse guardrail (Bash).
#
# Opt-in and inactive by default. Reads the Claude Code PreToolUse hook JSON from
# stdin and blocks (exit code 2) when the assistant tries to run a command owned
# by the user/controller. Read-only commands pass (exit 0). Never edits files,
# never commits. Fails open (exit 0) on empty or unparseable input so a malformed
# payload cannot wedge a session.

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

$command = ""
if ($payload.tool_input -and $payload.tool_input.command) {
    $command = [string]$payload.tool_input.command
}
if ([string]::IsNullOrWhiteSpace($command)) { exit 0 }

$forbidden = @(
    @{ Pattern = 'git\s+commit';         Reason = 'git commit is user/controller-owned; provide commit.ps1 commands for the user to run.' },
    @{ Pattern = 'git\s+push';           Reason = 'git push is user/controller-owned.' },
    @{ Pattern = 'git\s+merge';          Reason = 'git merge is part of user-run closeout.' },
    @{ Pattern = 'git\s+add';            Reason = 'raw git add is forbidden; commits go through commit.ps1, run by the user.' },
    @{ Pattern = 'git\s+rebase';         Reason = 'git rebase is not part of the Tidy workflow.' },
    @{ Pattern = 'git\s+reset\s+--hard'; Reason = 'destructive git reset is user-owned.' },
    @{ Pattern = 'commit\.ps1';          Reason = 'commit.ps1 is run by the user/controller.' },
    @{ Pattern = 'promote\.ps1';         Reason = 'promote.ps1 is run by the user/controller.' },
    @{ Pattern = 'open-phase\.ps1';      Reason = 'open-phase.ps1 is run by the user/controller.' },
    @{ Pattern = 'validate\.ps1';        Reason = 'validation is user/controller-run; provide the commands instead.' },
    @{ Pattern = 'npm\s+run\s+test:ci';  Reason = 'npm run test:ci is user/controller-run.' }
)

foreach ($rule in $forbidden) {
    if ($command -match "(?i)$($rule.Pattern)") {
        [Console]::Error.WriteLine("tidy command-boundary: blocked '$command'. $($rule.Reason)")
        exit 2
    }
}

exit 0
