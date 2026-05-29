# fix-mojibake.ps1
# Idempotent mojibake repair. Replaces known bad byte sequences in docs.
# Usage: .\scripts\fix-mojibake.ps1

$ErrorActionPreference = "Continue"
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

$targets = @(Get-ChildItem "docs/*.md" -File) + @(Get-Item "AGENTS.md")

$replacements = [ordered]@{
    "Ã¢â‚¬â€œ"   = "-"
    "Ã¢â‚¬â€"   = " - "
    "Ã¢â‚¬â€™"   = "'"
    "Ã¢â‚¬Â"     = " - "
    "â€"        = " - "
    "â€™"         = "'"
    "â€˜"         = "'"
    "â€œ"         = '"'
    "â€"          = '"'
    "â†'"         = "->"
    "â†"         = "<-"
    "âœ…"         = "[done]"
    "ðŸ”„"        = "[in progress]"
    "Â·"          = "-"
    "Â "          = " "
    ([string][char]0x2014)   = " - "
    ([string][char]0x2013)   = " - "
    ([string][char]0x2192)   = "->"
    ([string][char]0x2018)   = "'"
    ([string][char]0x2019)   = "'"
    ([string][char]0x201C)   = '"'
    ([string][char]0x201D)   = '"'
}

$totalFixed = 0

foreach ($file in $targets) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $original = $content
    foreach ($bad in $replacements.Keys) {
        $content = $content.Replace($bad, $replacements[$bad])
    }
    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($file.FullName, $content, $utf8NoBom)
        $count = ([regex]::Matches($original, [regex]::Escape($bad))).Count
        Write-Host "  Fixed: $($file.Name)"
        $totalFixed++
    }
}

if ($totalFixed -eq 0) {
    Write-Host "  No mojibake found - all files clean."
} else {
    Write-Host "  $totalFixed file(s) repaired."
}
