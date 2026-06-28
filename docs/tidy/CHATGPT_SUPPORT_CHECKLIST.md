# ChatGPT Support Checklist

Support checklist for ChatGPT work in Tidy.

This file is support-only. Authoritative role and evidence boundaries remain in `AGENTS.md` ("ChatGPT Reviewer Mode"), `docs/WORKFLOW.md` ("Local Evidence Packet"), `docs/CODEX_RULES.md` ("ChatGPT Reviewer Evidence Boundary"), and `docs/AI_HANDOFF.md`.

## Intended role

ChatGPT is the second-opinion provider, docs/workflow auditor (inconsistency, stale-end, disconnected-file, and wrong-path detection), and future-planning assistant. It reviews pushed GitHub state plus evidence pasted into the chat. It may read code and write repo changes only when explicitly working inside a scoped docs/workflow/support phase; its primary role stays review and audit. The authoritative role text remains in the owner docs above.

## Evidence boundary

- ChatGPT sees pushed GitHub state plus pasted evidence only.
- It cannot see local uncommitted work, branch-only files, local diffs or status, validation output, or generated graph changes.
- Source-heavy, branch-local, or graph-sensitive review requires a Local Evidence Packet (see `docs/WORKFLOW.md`).
- If evidence is absent, state that the review is pushed-remote-only. Never imply connector reads include local state.

## Checks before review

- Decide whether the question is answerable from pushed state alone or needs a Local Evidence Packet.
- Read the owner docs named in `docs/tidy/SOURCE_OF_TRUTH_MAP.md` before judging drift.
- Do not restate roadmap, version, phase, or architecture state from memory; cite the owner doc.

## Drift checks

- Do not treat `docs/tidy/*` as a source-of-truth owner.
- When a finding changes product, roadmap, version, workflow, or design truth, route it to the owner doc, not only this support file.
- Do not claim local validation results; validation evidence is user/controller-supplied.
