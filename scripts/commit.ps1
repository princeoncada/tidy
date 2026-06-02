# commit.ps1 — stage one or more files and commit with a message
#
# Usage:
#   .\scripts\commit.ps1 -Files "path/to/file.md" -Message "type(scope): summary"
#   .\scripts\commit.ps1 -Files "a.md","b.md","c.md" -Message "type(scope): summary"

param(
    [Parameter(Mandatory = $true)]
    [string[]]$Files,

    [Parameter(Mandatory = $true)]
    [string]$Message
)

$ErrorActionPreference = "Continue"
$dash = [char]0x2014

foreach ($file in $Files) {
    if (-not (Test-Path -LiteralPath $file)) {
        # Absent from the working tree: allow only if git already tracks it
        # (a deletion to stage); otherwise it is a genuine bad path.
        git ls-files --error-unmatch -- "$file" 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: $file $dash not found in working tree and not tracked by git"
            exit 1
        }
    }
    # -A stages additions, modifications, and deletions for this path.
    git add -A -- "$file"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: $file $dash git add failed"
        exit 1
    }
}

$commitOutput = git commit -m $Message 2>&1
if ($LASTEXITCODE -eq 0) {
    $hash = ""
    foreach ($line in $commitOutput) {
        if ($line -match '^\[[^\s]+ ([0-9a-f]+)\]') {
            $hash = $Matches[1]
            break
        }
    }
    $fileList = $Files -join ", "
    Write-Host "OK: $fileList $dash $hash $Message"
    exit 0
}

Write-Host "ERROR: git commit failed"
$commitOutput | ForEach-Object { Write-Host $_ }
exit 1
