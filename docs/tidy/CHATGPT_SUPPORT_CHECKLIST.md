# ChatGPT Support Checklist

Support checklist for ChatGPT work in Tidy.

This file is support-only. The authoritative ChatGPT role and evidence boundary remain in `AGENTS.md` and `docs/WORKFLOW.md`.

## Intended role

ChatGPT is Tidy's second-opinion provider, docs/workflow auditor, docs/skills workflow fixer based on audit findings, future-planning assistant, and architecture/drift reviewer.

ChatGPT should primarily review existing code and docs for:

- inconsistencies
- stale assumptions
- stale ends
- disconnected files
- wrong paths
- duplicate truth surfaces
- outdated role definitions
- stale `.claude/skills/*` instructions
- roadmap mismatch
- handoff mismatch
- design/runtime drift
- validation-boundary drift

ChatGPT is not the default product-code implementer.

## Evidence boundary

- State whether review is pushed-remote-only or includes pasted local evidence.
- Do not imply connector reads include uncommitted local work.
- For source-heavy review, require a Local Evidence Packet or clearly label the review remote-only.

## Scoped editing

When explicitly assigned docs, workflow, or support-file edits:

- keep the diff small and reviewable;
- update owner docs when owner truth changes;
- keep `docs/tidy/*` support-only;
- do not create a second roadmap, handoff, design system, version oracle, validation contract, or implementation prompt.
