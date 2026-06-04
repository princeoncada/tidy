# Tidy AI Harness Hooks

Opt-in Claude Code hook guardrails for the Tidy repo. Inactive by default:
nothing runs unless you copy a profile into your gitignored local settings.

## What these are

Real Claude Code hooks (SessionStart / PreToolUse) expressed in
hooks.template.json. Claude Code does NOT load hooks.template.json itself - it is
a reference template. Activation means copying one profile's "hooks" object into
.claude/settings.local.json, which is gitignored so activation is always personal
and never committed.

## Profiles

- minimal: SessionStart only - writes .tidy-ai/session-state.json and prints a
  reminder to use tidy-session-clone. No blocking.
- standard: minimal + command-boundary (PreToolUse on Bash). Blocks the assistant
  from running user/controller-owned commands: git commit/push/merge/add/rebase,
  destructive reset, commit.ps1, promote.ps1, open-phase.ps1, validate.ps1, and
  npm run test:ci. Read-only commands pass.
- strict: standard + edit-boundary (PreToolUse on Edit/Write/NotebookEdit). Blocks
  edits to product source (app, components, hooks, lib, trpc, prisma, tests) so a
  planning session cannot edit product code. Docs, .claude, ai-harness, and
  scripts remain editable.

## Activation (opt-in only)

1. Open hooks.template.json and pick a profile under "_profiles".
2. Copy that profile's "hooks" object into .claude/settings.local.json (create
   the file if missing). The pasted file looks like: { "hooks": { ... } }
3. Reload the Claude Code session so it reads settings.local.json.
4. .claude/settings.local.json is gitignored; activation is never committed.

## Blocking behavior

The guardrail scripts read the Claude Code PreToolUse JSON from stdin and exit
with code 2 to block, printing a short reason to stderr. They fail open (exit 0)
on empty or unparseable input so a malformed payload cannot wedge a session.
They block only the assistant's own tool calls; commands you run in your own
terminal are unaffected.

## Hard rules for any hook

- Never edit repo docs or source files.
- Never commit, push, or create branches.
- Never run validation or claim validation results.
- Write only to gitignored local memory (.tidy-ai/); never commit raw
  observations or transcripts.
- Hooks are never part of the session startup read set.

## Manual verification (opt-in)

These scripts have no app or CI test surface; verify them manually:
- A Bash payload that should block (expect exit code 2):
  pipe {"tool_name":"Bash","tool_input":{"command":"git commit -m x"}} into
  command-boundary-check.ps1.
- A read-only command that should pass (expect exit code 0):
  pipe {"tool_name":"Bash","tool_input":{"command":"git status"}} into
  command-boundary-check.ps1.
- Confirm .tidy-ai/ and .claude/settings.local.json stay gitignored:
  git status --short and git check-ignore .tidy-ai/ .claude/settings.local.json.
