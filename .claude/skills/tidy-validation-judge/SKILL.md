---
name: tidy-validation-judge
description: After the user pastes validation or git status evidence for a Tidy phase, decide the single next valid action. Use when validation or status output has been provided.
---

# tidy-validation-judge

Trigger / use case: the user/controller pasted validation output or git status/diff evidence during alpha work.

Read set (exact):
- docs/WORKFLOW.md - Validation-Gated Assistant Responses, Post-Validation Workflow, Post-Merge Validation, Closeout Evidence.
- docs/CODEX_RULES.md - validation boundary, commit discipline.

Do not read: product source unless classifying a specific failure (then defer to tidy-debug-attempt).

Allowed actions: classify the evidence; emit only the single next valid action.

Prohibited actions: running validation; claiming results the user did not paste; drip-feeding the whole workflow; giving closeout commands before alpha is green and the branch is clean; re-emitting promote.ps1's printed stable commit/push commands.

Output contract - classify into exactly one, then emit only its next action:

    1. Validation not provided -> give the validation commands only.
    2. RED + uncommitted work -> commit-before-fix: commit prior work (even while red) as its own unit(s), then the in-alpha fix prompt + revalidation.
    3. RED + work already committed -> in-alpha fix prompt + revalidation only.
    4. GREEN + uncommitted alpha changes -> alpha commit commands. For a low-risk phase (docs/workflow/tooling only; no product source, tests, or dependency changes) you may also include the full closeout packet in the same message, gated behind a clean git status --short. For product/source/test/dependency phases, give commit commands only.
    5. GREEN + branch clean -> full closeout packet (switch/pull/merge --no-ff with inline -m, post-merge validation path, promote.ps1, then run promote.ps1's printed Next steps).

Refusal rules: never assume green without pasted evidence; if evidence is ambiguous, ask for git status --short or the validate output before classifying.

Source of truth: docs/WORKFLOW.md Validation-Gated Assistant Responses + Post-Validation Workflow.
