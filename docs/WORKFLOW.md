# Agent Workflow

<!-- Current Version: 1.6.6-alpha -->

This file governs how Claude Code and Codex operate together in Tidy. Session startup is owned by the AGENTS.md Session Start Protocol; read this file only when writing or reviewing a Codex prompt or running the post-validation/closeout workflow, not at session startup. It is the authoritative protocol for all implementation phases.

---

## Roles

Three roles operate together: ChatGPT architects, Claude Code plans and validates, Codex implements. This section is the authoritative role-boundary definition; the ChatGPT Architect Mode subsection below adds only the evidence/scoping mechanics.

### ChatGPT (Architecture and Scoping)

ChatGPT is the **architecture and scoping layer**. It designs the approach, decides phase scope, and produces implementation direction from pushed GitHub state plus pasted local evidence; it has no direct local access. See ChatGPT Architect Mode below for the evidence-packet mechanics.

ChatGPT does **not**: read the local working tree directly, run commands, edit files, or claim local/validation results that were not pasted to it.

### Claude Code (Planning, Validation, Commit Blocks)

Claude Code is the **planning and validation layer**. It reads project state, scopes work, writes Codex prompts, validates output, and provides commit blocks for the user to run.

Claude Code does **not**: implement code, commit, push, run `npm run test:ci`, create branches, or run validation scripts.

**Exception**: Claude Code may implement directly only when explicitly unlocked with the [Implementation Gate](#implementation-gate) phrase.

### Codex (Implementation)

Codex is the **implementation layer**. It reads docs, edits source files, and summarizes what changed.

Codex does **not**: commit, push, run `npm run test:ci`, create branches, run validation scripts, run npm scripts, run graph audit commands, or claim validation results unless the user/controller provided the output.

---

## Session Start Protocol (Every Session)

Session startup is owned by the AGENTS.md Session Start Protocol - the single source of truth. Startup is limited to `git pull`, `STATE.json`, `codebase-graph.json` when present, and `docs/FUTURE_PLANS.md`, then the startup report. Do not read `docs/WORKFLOW.md`, `docs/COMPACT_STRATEGY.md`, `docs/AI_HANDOFF.md`, or `docs/CODEX_RULES.md` at startup; read them only when a task requires them.

Do not duplicate or diverge the startup steps here. See `docs/COMPACT_STRATEGY.md` for token budget targets and the active-work context-minimization protocol.

---

### ChatGPT Architect Mode

ChatGPT architect works from remote GitHub state plus pasted local evidence.
Remote master is authoritative only after push. The local working tree is
authoritative for uncommitted work, active branch edits, local validation
output, and regenerated graph output.

Before source-heavy scoping, the user/controller must paste a Local Evidence
Packet into ChatGPT chat. For docs-only roadmap/workflow phases, remote GitHub
reads plus pasted validation output are usually sufficient. For product/source
phases, ChatGPT must not scope from stale remote-only context when local changes
matter. If the Local Evidence Packet is absent, ChatGPT must state whether the
scope is remote-only.

LOCAL EVIDENCE PACKET TEMPLATE:

    git status --short
    git log --oneline -5
    Get-Content STATE.json
    npm run graph:codebase
    git diff --stat

OPTIONAL LOCAL EVIDENCE:

    git diff -- <path>
    Select-String -Path "docs\FUTURE_PLANS.md" -Pattern "<phase>"
    Select-String -Path "docs\AI_HANDOFF.md" -Pattern "<topic>"

Paste the packet into ChatGPT chat before scoping whenever local state can
change the architecture decision or implementation prompt.

When Claude Code is about to scope a source-heavy or local-sensitive phase, the
Local Evidence Packet's evidence must exist first, scoped by actor: a LOCAL
Claude Code session self-gathers it with its own tools and then scopes, rather
than emitting the packet for the user to paste back; the emit-and-wait form is
reserved for ChatGPT architect scoping or a Claude session without local access.
This pre-scope evidence step is separate from, and must not be conflated with,
the Section 2 `npm run graph:codebase` refresh that precedes `validate.ps1` for
any phase that edits tracked files.

---

## Implementation Gate

Claude Code implements directly **only** when the user provides this exact phrase:

```
I AUTHORIZE CLAUDE CODE TO IMPLEMENT - [reason]
```

Without this phrase, Claude Code writes Codex prompts using the 2-section format below.

Even when authorized, Claude Code never commits, pushes, creates branches, or runs `npm run test:ci`.

---

## Standard Phase Cycle

```
READ (STATE.json + codebase graph + minimal docs) -> CONFIRM (user direction)
  -> PLAN -> CLARIFY -> PROMPT (write Codex prompt)
  -> OPEN (.\scripts\open-phase.ps1) -> BUILD (Codex implements) -> TEST (user runs npm run test:ci)
  -> ANALYZE (pass/fail) -> FIX (if needed)
  -> PROMOTE (.\scripts\promote.ps1) -> COMMIT (user runs git)
```

### Phase Branch Lifecycle

Master must stay stable. Every new phase starts from stable master, then the
user/controller creates a phase branch before opening or implementing the phase.
Run open-phase.ps1 on the phase branch, not master.

Implementation loops happen only on the phase branch. Commit meaningful alpha
work one reviewable unit at a time. Meaningful failed validation states may be
committed when they preserve real debugging history; fake activity commits are
forbidden. If a phase expands too much, split the remaining work into the next
planned phase instead of looping endlessly.

Pre-Codex opening sequence (always emit in this order before pasting the master
prompt): (1) `git switch -c phase/<version-slug>` from clean stable master,
(2) `.\scripts\open-phase.ps1` with `-NextPhase`/`-NoNextPhase`, (3) run the
per-file opener commit commands open-phase prints, (4) a `Get-Content STATE.json`
confirm gate. Never emit the open-phase command without the preceding
branch-creation step. Because open-phase writes the In Progress pointer into
`docs/FUTURE_PLANS.md`, commit the opener before Codex edits that file.

During active editing, use targeted checks. Run full `.\scripts\validate.ps1` at
meaningful gates. When the alpha branch is clean and full validation is green,
provide the full closeout command packet: switch to master, pull master, merge
the phase branch with `--no-ff` and an inline `-m` message, run post-merge
validation on master using the documented post-merge validation rule, promote on
master, commit promotion files one by one, run a final targeted status check,
then push master. If any command in the closeout packet fails, stop and paste
the output before continuing.

If `git push` reports that the repository moved, update origin with
`git remote set-url origin https://github.com/princeoncada/tidy.git`. This is a
local repo maintenance action, not a product or phase implementation change.

### Planned Phase Capture

When the user and AI architect agree on a patch or phase sequence before implementation, the next scoped implementation phase must record that agreed sequence in `docs/FUTURE_PLANS.md`.

Rules:
- Insert newly agreed patch phases before the next minor/major phase when they must happen first.
- Preserve monotonic version order.
- Patches under the current minor may be inserted before the next minor without renumbering the next minor.
- New minor or major insertions must push later Planned versions back according to the Planned Renumber Rule in `docs/VERSIONING.md`.
- Do not leave the roadmap implying the next implementation is a later phase when cleanup patches have been agreed first.
- This does not make `docs/FUTURE_PLANS.md` a versioning location. It remains the roadmap owner only.
- `docs/FUTURE_PLANS.md` roadmap edits are owned by Codex through the master prompt, never handed to the user as manual hand-edits. For a brand-new (not-yet-listed) phase, put the roadmap-capture edits (new Planned heading with `Status: In progress`, any Potential Next Direction) into the Codex master prompt as ordinary MODIFY items. For an already-listed phase, `open-phase.ps1` flips its Status to In progress and writes the In Progress pointer; any further reconciliation of that heading (Files/Problem/Scope/Acceptance) is also a Codex MODIFY item. Because open-phase writes the In Progress pointer into `docs/FUTURE_PLANS.md`, commit the opener before Codex edits the same file so the granular commits stay separable.

### Product Phase Planning

Product implementation phases should be small and test-backed. Every product implementation phase must add or update useful tests unless explicitly scoped as docs-only/test-only with a reason.

Product behavior audits should become reproduction tests or roadmap acceptance criteria, not new standalone docs by default. UI/UX polish should stay late unless it blocks correctness or usability.

### Roadmap Next-Phase Gate

When `STATE.json` is stable, `STATE.json.nextPhase` must equal the first Planned heading in `docs/FUTURE_PLANS.md`.
Plain assertion: STATE.json.nextPhase must equal the first Planned heading.

Every `open-phase.ps1` invocation must declare the next phase explicitly: pass `-NextPhase "<version - title>"` matching the intended next Planned heading, or `-NoNextPhase` when no planned phase remains. The script errors if neither or both are given - there is no silent default - so a stale or self-referential nextPhase can never carry into promotion.

When opening an alpha phase, `STATE.json.nextPhase` must exist as a Planned heading unless the phase is explicitly scoped to add or renumber `docs/FUTURE_PLANS.md` in the same patch.

Use `open-phase.ps1 -AllowMissingNextPhase` only for explicitly scoped roadmap rewrite patches. No phase may be promoted stable while `STATE.json.nextPhase` and the first Planned roadmap item disagree. `docs/FUTURE_PLANS.md` remains roadmap state, not a sixth versioning location.

### Prompt Fence Safety

When an implementation prompt is delivered inside a fenced code block, do not place additional triple-backtick fenced blocks inside it. Nested fences can prematurely terminate the outer prompt and make copy-paste instructions unsafe.

Inside a fenced master prompt, represent commands/templates using plain text labels or indented lines, not nested fences. Keep Section 1 master prompts and Section 2 validation commands as separate top-level code blocks in the assistant response.

If the master prompt needs to include command examples, use labels like POWERSHELL COMMANDS, VALIDATION COMMANDS, or LOCAL EVIDENCE PACKET, followed by indented command lines. Do not use markdown triple-backtick fences inside a fenced master prompt.

### Alpha vs. Stable Scope Rule

Check STATE.json before deciding how to respond to a fix or change request:

- state = "alpha" - apply the fix directly as an in-alpha correction.
  No new Codex prompt, no version bump, no re-scope. Extend the current
  phase prompt with the additional changes only.
- state = "stable" - open a new phase. Write a full Codex prompt with
  version bump, READ THESE FILES FIRST, IMPLEMENTATION REQUIREMENTS,
  SAFETY CONSTRAINTS, and STOP AND SUMMARIZE.

Never re-scope a full phase for a fix when the current version is already alpha.

Never re-emit a full master prompt to change part of an already-delivered
prompt. Once a master prompt has been delivered - and especially once the phase
is open in alpha - apply changes as a labeled delta (only the changed items) or
route them through the in-alpha correction path. Re-emit a full prompt only if
the phase identity itself changed. Regenerating a whole prompt to fix a few
lines is forbidden token waste.

---

## Codex Prompt Format

Every Codex prompt uses a two-section format (Section 1 - Master Prompt, Section 2 - Validation). Section headings are markdown headers sitting above their code block - not inside it. The two-section structure is fixed; the depth of the Section 1 master prompt is chosen by task type (see Prompt Format Selection).

### Prompt Format Selection

Choose the Section 1 master-prompt style by task type. Both styles keep the same Section 2 validation block and the same Assistant Output Formatting Contract below.

- **Surgical format** (default for docs, config, and precise/known edits): full structure with READ THESE FILES FIRST, IMPLEMENTATION REQUIREMENTS using exact OLD TEXT / NEW TEXT pairs, SAFETY CONSTRAINTS, and STOP AND SUMMARIZE. Use when the change locations are known and exact text can be specified; it minimizes Codex exploration tokens and drift.
- **Exploratory format** (for source/feature work where exact edit points are not yet known): state Goal, Constraints (invariants that must not break), Expected outcome, and Codex instructions (read the routed files, locate the change, implement, run nothing, report changed files/tests/risks). Use exact OLD/NEW pairs only for the parts that are precisely known.

Prefer the surgical format whenever feasible; use the exploratory format only when the edit points genuinely cannot be pinned down in advance.

### Assistant Output Formatting Contract

- Keep markdown section headings outside code blocks.
- Section 1 - Master Prompt heading must stay outside the code block.
- Section 2 - Validation heading must stay outside the code block.
- The Codex prompt must be one text code block containing only the prompt intended for Codex.
- The validation block must be one PowerShell code block containing only validation commands.
- The alpha commit sequence must be one PowerShell code block containing all alpha commit commands, one command per line.
- Do not re-emit the stable promotion commit or push commands; promote.ps1 prints the exact per-file stable commit commands (including the conditional codebase-graph.json commit) and the final push, so instruct the user to run promote.ps1's printed Next steps instead.
- Never place `Section 1 - Master Prompt` or `Section 2 - Validation` inside
  copyable code blocks.
- Do not wrap both sections in one code block.
- Do not combine Codex prompt text and PowerShell commands in the same code block.
- The push command must be separate from commit command blocks.
- When providing a merge command, include the merge message inline with `-m` so
  Git does not open the default editor:
  `git merge --no-ff phase/<version-slug> -m "merge: bring <version> <short phase name> into master"`
- Code blocks must be copy-paste runnable for their target tool.
- Do not place explanatory prose, bullets, markdown headings, wrappers, or
  comments inside copyable command blocks unless they are commands the user
  should actually run.
- Use `text` for Codex prompt blocks.
- Use `powershell` for validation and command blocks.
- Codex implementation summaries must not include "Verified directly" or equivalent self-validation sections.
- Validation sections in Codex output must only contain commands for the user/controller to run.
- If Codex did not run validation, it must say "Validation not run by Codex."
- Codex must not claim validation/test/audit results unless the user provided them.

When scoping implementation prompts, include `codebase-graph.json` as an early
read after `STATE.json` when it exists. The graph narrows file selection; it
does not replace `docs/AI_HANDOFF.md`, `docs/CODEX_RULES.md`, or direct reads of
affected source files.

Use `docs/CONTEXT_INDEX.md` as the routing-only scoping map for choosing the
smallest correct document/source read set. It does not define process rules,
phase workflow, prompt format, or validation boundaries.

### Graph Routing Usage Contract

When scoping implementation prompts, include a short Graph Routing Summary
before Section 1 - Master Prompt. The Graph Routing Summary must stay outside code blocks and must not be included inside the Codex prompt block.

The summary must explain how `codebase-graph.json` narrowed file selection, list
selected files and why, list intentionally skipped broad docs/files, and state
whether source files still need direct reads before editing. It must not require
running graph audit during startup, must not require token benchmarking, and
must not add graph drills to every loop.

Graph Routing Summary:
- Task category: workflow/docs patch
- Graph-selected files: AGENTS.md, docs/WORKFLOW.md, docs/CODEX_RULES.md
- Intentionally skipped: app source, tRPC routers, Prisma output
- Direct reads still required: yes, read selected docs before editing

Section 2 must lead with this refresh only when the phase changes the source
file set (add/remove/rename) or any top-level exported symbol or import.
`open-phase.ps1` already refreshes and version-syncs the committed graph when the
alpha phase opens, and since 1.6.5 the generator captures only top-level exported
symbols, so a docs/skills or body-only phase that changes no source exports or
imports does not need a Section 2 graph refresh. When a refresh is needed:

```powershell
npm run graph:codebase
```

`scripts/validate.ps1` checks that the committed graph is present, versioned to
`STATE.json`, excludes protected paths, and is fresh against fallback generator
output. `validate.ps1` regenerates and gates graph freshness whether or not
Section 2 ran a manual refresh; if it ever reports the committed graph as stale,
run `npm run graph:codebase`, commit the result, and re-validate.

`npm run graph:audit` proves graph quality by checking required nodes,
classifications, protected-path exclusions, and routing metadata. It runs
through validation, not every startup. Do not add graph drill or audit docs to
the normal read loop.

### Section 1 - Master Prompt

A single `text` code block containing only the prompt intended for Codex. Every
master prompt that opens an alpha phase must include a PRECONDITION block
immediately after the opening version lines, telling Codex the opener has
already set the alpha version, to proceed if STATE.json matches, and to STOP and
report "run the opener first" if STATE.json still shows the prior stable
version. It contains all of the following blocks in this exact order:

```text
You are implementing Phase X.Y.Z - [Name] for Tidy.
Current stable version: X.Y.Z-stable.
This implementation opens X.Y.Z-alpha.

---

PRECONDITION:

The opener has already run and set STATE.json to X.Y.Z-alpha.
If STATE.json shows X.Y.Z-alpha, proceed.
If STATE.json still shows the prior stable version, STOP and report
"run the opener first" - do not treat this header as drift to reconcile,
and do not edit versioning files to force a match.

---

READ THESE FILES FIRST before writing any code:

- STATE.json
- docs/AI_HANDOFF.md
- docs/CODEX_RULES.md
- [2-3 source files directly relevant to this change]
- [if the phase creates or modifies scripts: list scripts/ to check for
  existing implementations before scoping anything new]

---

CURRENT PROJECT STATE:

Version: X.Y.Z-alpha
Series: [series label]
Last phase: [title] ([one-line result])
Next phase: [this prompt title]

---

IMPLEMENTATION REQUIREMENTS:

Every requirement is mandatory. Do not skip, defer, or partially implement.

[Numbered items. Label each CREATE or MODIFY.
 MODIFY items include exact OLD TEXT and NEW TEXT pairs.
 Do not alter any text outside the specified pairs.]

---

SAFETY CONSTRAINTS:

- Do not commit, push, or create branches
- Do not run npm scripts, git commands, or validation scripts
- Do not modify app/generated/prisma
- Do not touch unrelated files
- [phase-specific constraints]

---

STOP AND SUMMARIZE:

After completing all changes, stop and provide:
1. Files created (path + one-sentence purpose)
2. Files modified (path + what changed)
3. Whether app behavior changed
4. Validation not run by Codex
5. Commands for the user/controller to run next
```

### Section 2 - Validation

A single `powershell` code block containing only PowerShell validation commands:

```powershell
.\scripts\validate.ps1
Select-String -Path "docs\WORKFLOW.md" -Pattern "Section 1 - Master Prompt"
Test-Path "STATE.json"
```

---

## Validation-Gated Assistant Responses

Assistant command instructions are gated by user-provided evidence, but normal
user-facing replies should not label the flow as Stage A, Stage B, Stage C, or
similar. Use natural next-action wording.

During active alpha work, provide only the immediate next valid action:
- If implementation or in-alpha changes exist and validation output has not been provided, give validation commands only.
- If validation fails, commit any uncommitted prior work first, then give failure classification, an in-alpha fix prompt that follows `docs/CODEX_RULES.md` debugging attempt discipline, and revalidation commands.
- If validation is green but the alpha branch still has uncommitted changes, give alpha commit commands only - except for a low-risk phase (docs, workflow, or tooling only; no product source, tests, or dependency changes), where you may give the alpha commit sequence and the full closeout packet together in one message, with the closeout gated behind a clean `git status --short`.
- Do not normally label user-facing replies as Stage A, Stage B, Stage C, or similar.
- Do not provide the full closeout command packet before alpha validation is green. After it is green, provide it once the branch is clean - or, for a low-risk docs/workflow/tooling phase, in the same message as the alpha commit sequence with the closeout gated behind a clean `git status --short`. Keep commits and closeout in separate messages for any phase that changes product source, tests, or dependencies. This separation is a deliberate safety guard, not ceremony: a closeout packet is written against the branch as it looks at that instant, and source/test/dependency phases routinely need several more commit rounds (broken baseline, lint fix, graph refresh, opener files), so a co-emitted closeout goes stale immediately and tempts merging, promoting, or pushing before validation is truly green and `git status` is truly clean - risking incomplete or broken work on master. Separate messages force a fresh clean-and-green reality check at the irreversible step. Do not widen the low-risk consolidation exception to source/test/dependency phases to save a round-trip.

Commit-before-fix is mandatory. While any uncommitted implementation or fix
work exists on the phase branch, the assistant must provide commit commands for
that work first - committed as its own granular unit(s), even when validation is
red - and must not issue an in-alpha fix prompt until that work is committed. A
broken implementation is committed, never folded into its fix commit. The only
exception is genuinely accidental, never-meaningful edits (a stray edit, a wrong
paste, a typo'd command that changed no real files), which may be corrected
without a commit because committing them would be a forbidden fake-activity commit.

Once alpha validation is green and the phase branch is clean, the assistant may
provide the full closeout command packet. For a low-risk phase (docs, workflow,
or tooling only; no product source, tests, or dependency changes) the assistant
may include this packet in the same message as the alpha commit sequence, gated
behind a clean `git status --short`. The packet must include, in order:
- switch to master
- pull master
- merge into master using the inline `-m` merge message:
  `git merge --no-ff phase/<version-slug> -m "merge: bring <version> <short phase name> into master"`
- run the documented post-merge validation path on master
- promote
- run the per-file stable commit commands and the push that promote.ps1 prints in its Next steps; the assistant does not re-emit them

If any closeout command fails, stop and paste the output before continuing.

If the user says "we won't be promoting because we have a problem" or equivalent
during alpha, treat it as an in-alpha fix situation. Provide an in-alpha fix
prompt plus revalidation commands, not commit, merge, promote, or push
instructions.

---

## Validation Intensity

Full `.\scripts\validate.ps1` is the final confidence gate, not a command to
request after every tiny edit. Plainly: full validate.ps1 is not required after every tiny edit. During active in-alpha work, prefer targeted checks that match the risk of the change.

Targeted checks are acceptable while actively editing or confirming a narrow
docs fix, including:
- `Select-String` checks for required doc phrases
- `git status --short`
- `git diff --stat`
- focused file inspection
- `npm run graph:codebase` only when graph freshness needs to be restored before a full validation gate

Recommend full `.\scripts\validate.ps1` at meaningful gates:
- after an implementation or in-alpha fix batch is ready to prove
- before alpha work is considered ready for merge
- after merging the phase branch into master, before promotion, when
  [Post-Merge Validation](#post-merge-validation) requires full validation
- before final push only when the user wants final confidence or when source, scripts, product, tests, dependencies, or validation logic changed after the last full validation

Do not request full `.\scripts\validate.ps1` after every one-line docs edit,
after every `Select-String` check, after every individual commit, after every
graph refresh while still actively editing, or immediately after `promote.ps1`
when promote self-verify succeeds and only version/docs/graph metadata changed.
Plainly: promote.ps1 already self-verifies version locations, roadmap closeout,
and graph artifact consistency.

If product source, tests, scripts, dependencies, or validation logic changed,
treat full `.\scripts\validate.ps1` as required before closeout.

---

## Closeout Evidence

Plainly: git status --short is the primary check for uncommitted work and
closeout cleanliness. Plainly: git log --oneline -12 is optional audit evidence,
not the default cleanliness check.

Use `git log` when auditing meaningful alpha history, commit order, branch tip,
merge history, troubleshooting, or when the user asks to review the commit
story. Do not request `git log` after every commit or checkpoint by default.

---

## Generated Artifact Git Hygiene

`codebase-graph.json` is a generated artifact. Under `core.autocrlf=true`, a
regeneration can leave it flagged as modified in `git status` even when
`git diff` shows no change. This is a phantom dirty flag, not real work.

When a generated file shows as modified but `git diff` and
`git diff --numstat` are empty, it is a no-op: run `git restore <file>` to
clear it. Never commit a no-op change - committing one is a forbidden
fake-activity commit. `.gitattributes` pins `codebase-graph.json` to
`eol=lf` so this churn does not recur.

---

## Post-Merge Validation

Branch validation proves the phase branch state; post-merge validation proves the
final master state. Full post-merge `.\scripts\validate.ps1` is required when
product source, tests, scripts, dependencies, validation logic, conflict
resolution, or a significantly moved master could change final behavior.

For docs-only clean merges from freshly pulled master, after full alpha branch
validation has passed, targeted post-merge checks may be acceptable. Targeted
post-merge checks can include `git status --short`, selected version/roadmap
`Select-String` checks, graph freshness checks when graph metadata changed, and
task-specific file inspection. The user/controller may still choose full
validation for final confidence.

---

## Post-Validation Workflow

After the user/controller provides validation output or status evidence, Claude
Code first runs its own `git status --short` to check whether the five opener
files (STATE.json, package.json, docs/VERSIONING.md, docs/WORKFLOW.md,
docs/FUTURE_PLANS.md) from open-phase.ps1 are still uncommitted. If they are,
Claude Code front-loads an opener-commit section at the very top of its response
(above the normal continuation) so the opener lands before later work; if they
are already committed, it simply confirms the tree looks right and continues.
Opener-commit commands are never inlined into the original scope; this catch-up
is a post-validation safety check the assistant owns. Claude Code then classifies
the next valid action from
[Validation-Gated Assistant Responses](#validation-gated-assistant-responses).
During active alpha work, provide only that immediate next action. Once alpha
validation is green and the phase branch is clean, provide the full closeout
packet instead of drip-feeding merge, post-merge validation, promotion, stable
commits, final targeted status check, and push one message at a time.

1. Validation summary - pass counts, failures, and warnings from user-provided output only. If validation failed and uncommitted implementation or fix work exists, provide commit commands for that work first (committed even while red), then the in-alpha fix prompt and revalidation commands. If the failed work is already committed, provide the in-alpha fix prompt and revalidation commands only.
2. Alpha commit sequence - When alpha validation is green but uncommitted alpha changes remain, provide one PowerShell code block containing all alpha commit commands, one command per line.

```powershell
.\scripts\commit.ps1 -Files "path/to/file" -Message "type(scope): message"
```

3. Closeout packet - When alpha validation is green and the phase branch is
   clean, provide command blocks that take the user from merge through final
   push. The merge command must include the inline `-m` message. After the
   merge, choose the post-merge validation path from
   [Post-Merge Validation](#post-merge-validation):

```powershell
git switch master
git pull origin master
git merge --no-ff phase/<version-slug> -m "merge: bring <version> <short phase name> into master"
```

   If full post-merge validation is required, provide:

```powershell
.\scripts\validate.ps1
```

   If targeted post-merge checks are acceptable for a clean docs-only merge,
   provide targeted checks that match the phase evidence, including:

```powershell
git status --short
```

4. Promote block - after the selected post-merge validation path passes, provide
   the promote command:

```powershell
.\scripts\promote.ps1
```

   promote.ps1 promotes the five versioning locations, closes the promoted
   phase in `docs/FUTURE_PLANS.md` as roadmap state, and refreshes
   `codebase-graph.json` when graph tooling exists. FUTURE_PLANS is not a
   sixth versioning location, and `codebase-graph.json` is a generated graph
   artifact, not a sixth versioning location. The script self-verifies that all
   five versioning locations carry the new stable version, roadmap closeout
   succeeded, and the graph artifact matches the stable version/schema. If
   promote.ps1 reports roadmap closeout or graph refresh failure, stop and do
   not commit the promotion. Do NOT re-run the full validation suite after
   promote unless the user chooses to - app code did not change, only version
   strings, roadmap state, and generated graph metadata. If promote reports
   success, the user runs the per-file commit and push commands promote.ps1 printed in its Next steps.

5. Run promote.ps1's printed Next steps - promote.ps1 prints the exact per-file stable-promotion commit commands (including the conditional `codebase-graph.json` commit) and the final `git push origin master`. The assistant must NOT re-emit those commands; tell the user to run promote.ps1's printed Next steps in order. If `git push` reports that the repository moved, run `git remote set-url origin https://github.com/princeoncada/tidy.git` then retry the push.

Do not emit each alpha commit command as its own separate code block. Use
one-by-one blocks only when the user explicitly asks for them. Commit command
blocks must be copy-paste runnable as-is in PowerShell.

---

## Session Continuation and Checkpoints

Normal continuation uses a minimal handoff, not a committed SESSION_LOG
checkpoint. When the user signals stopping, switching, stepping away, or that
context may compact, run the tidy-minimal-handoff procedure: emit a single
low-token handoff packet (repo and URL, user intent, fresh state from STATE.json,
whether local evidence is required, the smallest next read set, which Tidy skill
to invoke next, and an explicit do-not-read list). The minimal handoff plus
STATE.json + docs/FUTURE_PLANS.md + docs/AI_HANDOFF.md is the continuity
mechanism; a brand-new model must be able to resume from those alone.

One phase per session is a hard rule: scope and run a single phase, then at
promotion STOP, emit a minimal handoff, and start the next phase in a fresh
session. Never chain phases (open one, promote it, then immediately scope the
next) in the same session - that balloons context and forces an expensive
full-transcript reload on the next start. Prefer targeted reads (Grep or
offset+limit on the needed block) over full-file reads of large docs, and never
re-read a file already read in the session. See `docs/COMPACT_STRATEGY.md`
Context Discipline for the full rationale.

SESSION_LOG is historical audit only, not the normal continuation path. Write a
committed checkpoint only for the rarer audit cases: a phase retrospective, a
durable record of a large, risky, or many-file operation, or investigating why a
past decision was made.

### Session Checkpoint Output Contract (Optional Audit Mode)

When the user explicitly says "session checkpoint", "create a session
checkpoint", "let's do a session checkpoint", or equivalent, the response is not
itself implementation. It must provide, in order:

Section 1 - Session Log Master Prompt for Codex
Session checkpoint commit script
Section 2 - Next ChatGPT Handoff Prompt

Section headings stay outside code blocks. Section 1 and Section 2 should be
inside code blocks in the assistant response. The session checkpoint commit
script must be a separate PowerShell code block between Section 1 and Section 2.
Do not include nested fenced code blocks inside fenced master prompts or handoff prompts.

Section 1 must be a copy-paste-safe prompt for Codex to create a new checkpoint
file under `docs/SESSION_LOG/YYYY-MM-DD-session-NN.md`. It must tell Codex to
read `STATE.json`, `docs/FUTURE_PLANS.md`, `docs/AI_HANDOFF.md`,
`docs/WORKFLOW.md`, `docs/VERSIONING.md`, `docs/CONTEXT_INDEX.md`,
`docs/SESSION_LOG.md`, and the latest file under `docs/SESSION_LOG/` if one
exists; create the `docs/SESSION_LOG/` folder if missing; create the next dated
session file; preserve source-of-truth boundaries; not use `docs/PHASE_LOG.md`
as active guidance; not modify product source files; not run validation or git
commands; and stop and summarize files changed. Do not append directly to docs/SESSION_LOG.md, because `docs/SESSION_LOG.md` is an
index/pointer only. Plainly: docs/SESSION_LOG.md is an index/pointer only. It must instruct Codex to update `docs/AI_HANDOFF.md` only
if current state or next step changed, and update `docs/NEW_CHATHEAD_OPENER.md`
only if the next-chat opener changed.

The session checkpoint commit script must include the checkpoint commit, optional
handoff/opener commits only when those files changed, then status and push:

```powershell
.\scripts\commit.ps1 -Files "docs/SESSION_LOG/YYYY-MM-DD-session-NN.md" -Message "docs(session): add YYYY-MM-DD session NN checkpoint"
.\scripts\commit.ps1 -Files "docs/AI_HANDOFF.md" -Message "docs(handoff): update handoff after session checkpoint"
.\scripts\commit.ps1 -Files "docs/NEW_CHATHEAD_OPENER.md" -Message "docs(session): update new chathead opener"
git status --short
git push origin master
```

Include the `docs/AI_HANDOFF.md` commit only if `docs/AI_HANDOFF.md` changed.
Include the `docs/NEW_CHATHEAD_OPENER.md` commit only if
`docs/NEW_CHATHEAD_OPENER.md` changed.

Section 2 must be a copy-paste-safe prompt for the next ChatGPT chathead. It
must include the repository name and URL, current confirmed stable version and
phase, next planned phase, what was completed this session, key workflow rules
now locked in, current local/remote caveats when any are known, startup
requirements for the next chathead, instruction not to implement until the user
confirms, instruction to verify remote master first, and a pointer to
`docs/NEW_CHATHEAD_OPENER.md` instead of embedding the full opener inline.

### Local Memory Boundary (Opt-In)

The opt-in ai-harness hooks may write local scratch and a learning queue under
the gitignored .tidy-ai/ path. This local memory never replaces the committed
SESSION_LOG checkpoint above: raw observations and session scratch stay local
and are never committed, and learning candidates become committed docs only
through a normal user-approved phase. session-checkpoint.ps1 produces a local
draft only; the committed checkpoint still follows the Session Checkpoint Output
Contract.

---

## Skill Surface

Operational Claude Code procedures live as real skills under `.claude/skills/`.
Skills are the execution layer for repeatable Claude Code loops; the docs remain
the source of truth. ChatGPT and Codex do not load skills; they read the docs.

### Skill Registry

| Skill | Use when | Source of truth it executes |
|-------|----------|------------------------------|
| tidy-session-clone | starting or resuming a session | AGENTS.md Session Start Protocol |
| tidy-minimal-handoff | handing off / stopping / switching tasks | docs/WORKFLOW.md Session Continuation and Checkpoints |
| tidy-codex-prompt-builder | scoping a phase / writing a Codex prompt | Codex Prompt Format (this file) + docs/CODEX_RULES.md |
| tidy-validation-judge | validation or status evidence was pasted | Validation-Gated Assistant Responses (this file) |
| tidy-debug-attempt | a check or test failed and a fix is considered | docs/CODEX_RULES.md Debugging Attempt Discipline |
| tidy-skill-evolution | formalizing local learning candidates | this section + docs/FUTURE_PLANS.md |
| tidy-context-budget | checking workflow/doc context overhead | docs/COMPACT_STRATEGY.md |
| tidy-eval-harness | defining or running a phase eval/proof artifact | docs/evals/README.md + docs/evals/template.md |

### Docs vs Skills Split

- Docs own policy, rules, boundaries, state, roadmap, and product truth (the why and the invariant).
- Skills own the ordered procedure and the smallest executable template (what to do, step by step).
- A skill must carry a "Source of truth:" pointer to the governing doc section and must not restate doc policy prose. Where a full rule matters, the skill links the doc, it does not copy it.
- If a skill and a doc disagree, the doc wins; fix the skill.

### Skill Evolution Loop

Skills improve over time but never self-mutate automatically:

1. User or an opt-in hook records a local observation in `.tidy-ai/learning-queue.md` (gitignored, never committed).
2. tidy-skill-evolution reviews candidates only when explicitly asked.
3. Claude proposes a skill/doc improvement.
4. User approves.
5. A normal phase updates the skill/doc.
6. Validation runs (user/controller).
7. The change is committed as versioned workflow evolution.

Committed skill changes follow the same versioning discipline as docs: while STATE.json state = alpha, skill tweaks are in-alpha corrections; while stable, a skill change opens a new Z patch. tidy-skill-evolution never auto-promotes a candidate; it proposes a roadmap phase.

---

## Post-Stable Bug Rule

Any bug discovered after a stable release always opens a `Z+1` patch:

1. Never modify a stable release in place
2. The Codex prompt must bump all five versioning locations to `X.Y.(Z+1)-alpha`
3. Follow the standard phase cycle: implement -> test -> promote -> commit

See `docs/VERSIONING.md` for the five versioning locations and the full bump rules.

---

## Versioning Locations (All Five, Every Bump)

1. `STATE.json` - `version` + `state` fields
2. `docs/VERSIONING.md` - history table + current state row
3. `docs/AI_HANDOFF.md` - `<!-- Current Version: X.Y.Z -->` comment at top
4. `package.json` - `version` field
5. `docs/WORKFLOW.md` - `<!-- Current Version: X.Y.Z -->` comment at top (this file)

`.\scripts\open-phase.ps1` opens a new alpha phase across all five versioning locations automatically.
`.\scripts\promote.ps1` handles all five versioning locations automatically and
also closes the promoted roadmap item in `docs/FUTURE_PLANS.md` when present.
It refreshes `codebase-graph.json` when graph tooling exists; the graph is a
generated artifact, not a sixth versioning location.
