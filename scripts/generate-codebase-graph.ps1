param(
  [switch]$FallbackOnly
)

$ErrorActionPreference = "Stop"

$args = @()
if ($FallbackOnly) {
  $args += "--fallback-only"
}

python "$PSScriptRoot\generate_codebase_graph.py" @args
