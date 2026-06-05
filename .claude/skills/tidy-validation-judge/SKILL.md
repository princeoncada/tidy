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

Prohibited actions: running validation; claiming results the user did not paste; drip-feeding the whole workflow; giving closeout commands before alpha is green and the branch is clean; re-emitting promote.ps1's printed stable commit/push commands; re-emitting a full master prompt to apply an in-alpha fix - in-alpha corrections are delivered as labeled deltas or surgical OLD/NEW edits, never a full re-scoped prompt.

Before classifying, run git status --short and check whether the five opener files (STATE.json, package.json, docs/VERSIONING.md, docs/WORKFLOW.md, docs/FUTURE_PLANS.md) from open-phase.ps1 are still uncommitted; if so, front-load an opener-commit section at the very top of the response (above the classification's next action), then continue. If they are already committed, just confirm and proceed. Opener commits are never inlined into the original scope - this catch-up is a post-validation safety check the judge owns.

Output contract - classify into exactly one, then emit only its next action:

    1. Validation not provided -> give the validation commands only.
    2. RED + uncommitted work -> commit-before-fix: commit prior work (even while red) as its own unit(s), then the in-alpha fix prompt + revalidation.
    3. RED + work already committed -> in-alpha fix prompt + revalidation only.
    4. GREEN + uncommitted alpha changes -> alpha commit commands. For a low-risk phase (docs/workflow/tooling only; no product source, tests, or dependency changes) you may also include the full closeout packet in the same message, gated behind a clean git status --short. For product/source/test/dependency phases, give commit commands only.
    5. GREEN + branch clean -> full closeout packet, emitted byte-identically from the Closeout Packet Template below (switch/pull/merge --no-ff with inline -m, post-merge validation path, promote.ps1, then run promote.ps1's printed Next steps). This is the single next action after a green alpha validation run; never route a green phase-branch validation to promote.ps1 directly.

Closeout Packet Template (case 5; emit byte-identical, substituting only the angle-bracket placeholders):

    git switch master
    git pull origin master
    git merge --no-ff phase/<version-slug> -m "merge: bring <version> <short phase name> into master"

Then the post-merge validation path (full .\scripts\validate.ps1 when source/tests/scripts/dependencies/validation logic changed; targeted checks for a clean docs-only merge):

    .\scripts\validate.ps1

Then promote and run promote.ps1's printed Next steps (never re-emit promote.ps1's stable commit/push commands):

    .\scripts\promote.ps1

If promote.ps1's printed Next steps are no longer on screen, do not improvise them - reconstruct from the canonical fallback in `.claude/skills/tidy-codex-prompt-builder` (Script-printed command rule, "Fallback when the printout is gone").

Refusal rules: never assume green without pasted evidence; if evidence is ambiguous, ask for git status --short or the validate output before classifying.

Source of truth: docs/WORKFLOW.md Validation-Gated Assistant Responses + Post-Validation Workflow.
