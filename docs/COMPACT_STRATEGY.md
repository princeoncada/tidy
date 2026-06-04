# Compact Strategy

Context is finite. This doc explains how Claude Code and Codex minimize session-start overhead and keep context windows clean throughout long-running phases.

---

## Priority Reading Order

Session startup is owned by the AGENTS.md Session Start Protocol (limited to `STATE.json`, `codebase-graph.json` when present, and `docs/FUTURE_PLANS.md`). For the per-task active-work read set, use the Task Routes in `docs/CONTEXT_INDEX.md` - the single routing map. Always start from `STATE.json` and the graph, then read only what the route names.

Never scan the repo broadly. Never open files speculatively. `docs/PHASE_LOG.md` is historical and not part of the normal active read path.

---

## STATE.json Is the Oracle

Read `STATE.json` at session start. It contains everything needed to orient before reading anything else:

- `version`  -  current version string (e.g., `1.0.0-alpha`)
- `state`  -  `alpha` or `stable`
- `phase`  -  phase number
- `phaseTitle`  -  what the current phase is about
- `nextPhase`  -  what comes after

Do not open `docs/VERSIONING.md` just to check the version. STATE.json is authoritative. Only read VERSIONING.md when you need the full history table or planned phases.

---

## ChatGPT Architect Context Boundary

The ChatGPT architect works from pushed GitHub state plus pasted local evidence
only. Local uncommitted work, branch-only files, local validation output, and
regenerated graph output are invisible to the ChatGPT architect until pushed or
pasted.

Committed `codebase-graph.json` is available to ChatGPT after push through
GitHub. Local regenerated graph output is invisible to ChatGPT until pushed or
pasted. The graph is an orientation map only; it does not replace direct file
reads or pasted local evidence.

---

## Token Budget Targets

| Session Phase | Target Overhead |
|---|---|
| STATE.json only | < 500 tokens |
| + CODEX_RULES routing table | < 1,000 tokens additional |
| + active phase log (if needed) | < 2,000 tokens additional |
| **Total session-start budget** | **< 8,000 tokens** |

Before this strategy: opening entrypoint + all feature docs + phase logs at session start cost ~12,000 - 15,000 tokens and grew with every new doc. Query-first retrieval cuts this by 60 - 70% and scales with project size.

---

## Context Budget Audit

Run `npm run budget:context` (or `scripts/ai-context-budget.ps1`) on demand to
estimate the token cost of the AI workflow surface and catch docs-led bloat
before it creeps back. The audit is never part of session startup and calls no
external service.

It groups files by how often they load:
- Startup docs (STATE.json, docs/FUTURE_PLANS.md, AGENTS.md, CLAUDE.md), measured
  against the session-start budget above.
- codebase-graph.json, reported separately as an orientation artifact read
  selectively, so its full size overstates real startup cost.
- Task-routed docs loaded during scoping or implementation.
- Optional/historical files (phase log, session logs, ai-harness/**) that cost
  nothing until read.

Estimates use a characters/4 heuristic, so treat them as relative signal, not an
exact tokenizer. Use the top bloat sources to decide what to trim.

## Graphify Code Navigation

tidy's graph is the committed `codebase-graph.json` (a normalized symbol/import
map). It is a static artifact, not a live service:

1. Read `codebase-graph.json` before touching source files to pick the smallest direct-read set
2. For deeper orientation, read more of `codebase-graph.json` or the source files it points to
3. Regenerate it with `npm run graph:codebase` after layout changes; `validate.ps1` gates freshness
4. Do NOT run the live graphify CLI (`graphify query`, `graphify path`, `graphify explain`); tidy does not generate `graphify-out/`, so those commands error here

The graph maps files/symbols by name, not meaning. Use it to find which file owns a symbol, not to answer "what handles X" questions. For those, read the appropriate doc.

---

## What Not to Read

| Situation | Skip this | Use this instead |
|---|---|---|
| Check current version | `docs/VERSIONING.md` | `STATE.json` |
| Find a file location | Broad `Glob` | `docs/AI_HANDOFF.md` Key Files + graphify |
| Understand data model | Scanning all routers | `prisma/schema.prisma` + Architecture Invariants in `docs/AI_HANDOFF.md` |
| Understand optimistic flow | `hooks/useOptimisticSync.ts` raw | Architecture Invariants in `docs/AI_HANDOFF.md` |
| Understand view/tag logic | Full component tree | Architecture Invariants in `docs/AI_HANDOFF.md` + `trpc/routers/viewHelpers.ts` |
| Know what to implement next | Full backlog scan | `docs/FUTURE_PLANS.md` + STATE.json `nextPhase` |
