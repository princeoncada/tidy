# Tidy AI Harness Hooks

These hook templates are opt-in and inactive by default. Nothing here runs
unless a user or controller intentionally activates it.

## Default state

- hooks.template.json ships with "enabled": false and "activationProfile": null.
  It is a template, not an active configuration.
- No hook scripts exist yet. The referenced ai-harness/hooks/scripts/*.ps1 paths
  are placeholders for the local-memory hooks introduced opt-in in 1.5.1.

## Activation (opt-in only)

1. Copy hooks.template.json to your own activated config outside version control
   or under a gitignored path.
2. Set "enabled": true and choose an "activationProfile".
3. Provide the referenced scripts. Until then, activation is a no-op.

## Hard rules for any hook

- Never edit repo docs or source files.
- Never commit, push, or create branches.
- Never run validation or claim validation results.
- Write only to gitignored local memory (introduced in 1.5.1); never commit raw
  observations or transcripts.
- Hooks are never part of the session startup read set.
