# Codebase Graph

`codebase-graph.json` is Tidy's committed orientation map. It summarizes source
files, simple symbols, and internal import edges so future agents can choose a
small direct-read set before opening deeper docs or source files.

Agents should read `STATE.json` first, then `codebase-graph.json` when it exists,
then the workflow docs required for the task. The graph is navigation support
only. It is not a source of truth, and app behavior must not be inferred solely
from it when making code changes.

Regenerate the graph after workflow, script, docs, or source layout changes:

```powershell
npm run graph:codebase
```

The generator prefers Graphify CLI output from the `graphifyy` package when the
`graphify` command is available and produces `graphify-out/graph.json`. If
Graphify is unavailable or its output cannot be parsed, the fallback scanner
keeps the workflow usable without extra dependencies.

To force the fallback scanner:

```powershell
.\scripts\generate-codebase-graph.ps1 -FallbackOnly
```

The fallback scanner reads UTF-8 files with Tidy's source extensions, resolves
relative imports plus the root-level `@/` alias, and excludes protected or
generated paths. Intentionally excluded paths include:

- `app/generated/prisma/`
- `node_modules/`
- `.next/`
- `.git/`
- `graphify-out/`
- `chroma-data/`
- `coverage/`
- `test-results/`
- `playwright-report/`
- `docs/SESSION_LOG/`
- `codebase-graph.json`

`scripts/validate.ps1` checks that the graph exists, matches the current
`STATE.json` version, excludes protected paths, and is fresh against the
fallback generator output. If it fails freshness, regenerate with
`npm run graph:codebase`.

Stable promotion refreshes `codebase-graph.json` so its embedded version matches
`STATE.json`. If validation reports graph staleness, run `npm run graph:codebase`.
