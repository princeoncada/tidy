# Tidy AI Harness Hooks

These hook templates are opt-in and inactive by default. Nothing here runs
unless a user or controller intentionally activates it.

## Default state

- hooks.template.json ships with "enabled": false and "activationProfile": null.
  It is a template, not an active configuration.
- Hook scripts exist under ai-harness/hooks/scripts/ as of 1.5.1, but the
  template keeps every hook disabled, so nothing runs by default.

## Activation (opt-in only)

1. Copy hooks.template.json to your own activated config outside version control
   or under a gitignored path.
2. Set "enabled": true and choose an "activationProfile".
3. The referenced scripts exist under ai-harness/hooks/scripts/; they run only
   when you enable a hook in your activated config. Until enabled, activation is
   a no-op.

## Hard rules for any hook

- Never edit repo docs or source files.
- Never commit, push, or create branches.
- Never run validation or claim validation results.
- Write only to gitignored local memory (introduced in 1.5.1); never commit raw
  observations or transcripts.
- Hooks are never part of the session startup read set.

## Manual verification (opt-in)

These scripts have no app or CI test surface; verify them manually if desired:
- Run ai-harness/hooks/scripts/observe.ps1 -Note "test" and confirm
  .tidy-ai/learning-queue.md is created.
- Run git status --short and git check-ignore .tidy-ai/ to confirm .tidy-ai/ is
  gitignored and never staged.
