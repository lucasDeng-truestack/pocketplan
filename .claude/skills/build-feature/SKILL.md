---
name: build-feature
description: Lead-developer workflow for building features in PocketPlan — clarify requirements first, architect, build contract first, review and fix in a loop, verify, then hand off. Use for any multi-step feature, refactor, or new module when you are the only agent (Cursor, Codex, a single Claude Code session without subagents, or a change too small to be worth orchestrating). In Claude Code with the Agent tool and a feature spanning more than a couple of files, use the orchestrate skill instead — it wraps this one. Invoke before writing any code.
---

# Build Feature — Lead Developer Workflow

You are acting as the lead developer on this codebase. Your job is not to write code
fastest — it is to ship the *right* change, verified, consistent with the repo's rules,
and cleanly handed off. Follow the five phases in order. Each phase has a gate; do not
pass a gate by assumption.

**Golden rule: facts live in the repo — go read them. Intent lives with the user — go ask.**
Never burn tokens guessing at intent, and never interrupt the user for facts you can
grep for yourself.

**Which skill?** This skill is the single-agent path: you do every unit yourself, in
order. If you are in Claude Code, the `Agent` tool is available, and the change spans
more than a couple of files or more than one app, stop and invoke `orchestrate` instead
— it runs these same phases with plan mode as the approval gate and delegates the units
to Opus/Sonnet subagents. The references under `references/` are shared by both skills;
edit them here, never copy them.

## Phase 0 — Context (read before anything)

0. **Record the baseline.** Save `git status --porcelain` and `git diff --stat` to your
   notes (scratchpad if you have one). The tree may carry unrelated uncommitted work;
   the review in Phase 4 must scope to *this* task's files, not the whole tree.
1. Read `.claude/CLAUDE.md` (product rules, money rules, how Lucas works) and
   `docs/plan.md` (the approved product plan: scope, flows, data model, decisions).
   Nothing in a feature may contradict the plan without Lucas agreeing first.
2. Read `docs/architecture.md` for the stack, layout, error model, response shapes and
   the lint/test commands. If the feature has a Claude Design hand-off under
   `docs/design/`, read it: it is the layout and copy; the components come from the
   project's `components/ui`.
3. Find the closest existing feature and read it end-to-end (route or action → service
   → client → page → components). Copy its shape. A feature that ignores an existing
   pattern is wrong even if it works. Business logic stays out of components: the
   mobile app will reuse it.
4. Check `docs/` for any other note about this area before designing anything.

## Phase 1 — Clarify (gate: requirements are unambiguous)

Before designing, list every open question. Answer from the codebase what you can.
For the rest, **ask the user in one batch** — do not trickle questions one at a time,
and do not proceed on guesses. Questions that are almost always worth asking for this
repo when the request doesn't specify:

- **Scope:** server only, UI only, or both? Does it change the data model or a money
  rule in `docs/plan.md`?
- **Data:** new tables/fields, or reuse? Archive (never delete history). Existing data
  to migrate?
- **Money:** which balances change, and how does the invariant (unallocated + envelopes
  = total) stay true? Does the overspending decision apply?
- **Ownership:** everything is per signed-in user; is there any sharing implied?
- **UX:** list + detail, sheet, or dialog? What is the quick path on a phone?
- **Edge policy:** what should happen on the ugly path (empty state, archived envelope,
  zero money, a refund larger than the expense, a failed email send)?

If the user is unavailable, state your assumptions explicitly at the top of your plan,
choose the most conservative option, and flag them again in the handoff.

**Gate:** you can state, in two sentences, what will exist when you're done and how the
user will confirm it works. If you can't, you're not ready.

## Phase 2 — Architect (gate: written plan exists)

Write the plan down before implementing (a short markdown block is enough):

- Files to create/modify, grouped by app.
- Schema changes → plan the migration; in implement phase **apply locally** with the
  project's migration tool (local database only), then regenerate the client. Never
  leave pending local migrations unapplied.
- API surface: route or server action + auth requirement + input/output shape, errors
  through the project's error model (`docs/architecture.md`).
- UI: pages/components, which existing `components/ui` and helpers you'll reuse (money
  formatter, date formatter, API client wrapper).
- Order of work: contract first, then units in dependency order (see Phase 3).
- Test/verify strategy: which lint commands, what manual flow proves it works, which
  screens to look at in the browser if a dev server is available.

Before freezing the plan, re-check every number, count, path and version string in it
against the raw output it came from. A wrong fact in the plan is copied faithfully into
the code.

Show the plan to the user before implementing when the feature touches schema, money
rules, auth or email sending; otherwise include it at the top of your response and
proceed. (Under `orchestrate`, plan mode makes this gate explicit.)

## Phase 3 — Implement

Work in units, contract first, in this order — the decomposition is the value even when
one agent does all of it, because the review in Phase 4 checks each unit against the
plan:

1. **Contract first:** schema + shared types + route or action signatures. Everything
   else depends on this. Apply the migration locally and regenerate the client now.
2. **Server unit:** service + routes or actions + the money-invariant test, against the
   frozen contract.
3. **UI unit:** client calls + pages + components, against the same contract.
4. **Docs unit (optional):** `docs/architecture.md` or feature notes when behaviour changes.

If the contract must change mid-way, stop, change it, update the plan, and re-check the
units already written against the new contract before continuing.

Write your own "packet" for each unit as working notes — the Task / Contract / Files /
Conventions / Verify sections from `references/delegation.md` — so Phase 4 has something
objective to review against. If you do have the `Agent` tool and find yourself wanting to
delegate a unit, that is the signal to switch to `orchestrate`; do not improvise a
delegation here.

## Phase 4 — Review Loop (gate: clean review)

You now switch roles: you are the reviewer, and the implementation is untrusted. Use
`references/review-checklist.md` — it contains the repo-specific checks and grep
patterns. Scope everything to the files this task touched (diff against the Phase 0
baseline). The loop:

1. Run the mechanical checks (lint/tsc per app, the checklist §1 greps).
2. In Claude Code, invoke the `code-review` skill at level `high` targeting the touched
   paths. Elsewhere, read the diff as a reviewer yourself: correctness, edge cases, rule
   compliance, reuse.
3. Walk checklist §2–§5 against the diff for what a generic review cannot know
   (ownership, money invariant, history preservation, Resend guards, bounded queries).
4. UI touched and a dev server available? Open the changed screens at a phone width
   and look before you fix anything else; hierarchy problems are not greppable.
5. Write findings as one numbered list with `file:line`, ordered by the checklist's
   severity discipline. Fix them. Re-review only the fixes.
6. Repeat until a pass produces zero findings. Cap at 3 cycles. If findings persist
   after 3, stop and escalate to the user with the remaining list — do not silently ship
   known issues, and do not loop forever.

## Phase 5 — Verify & Hand Off

- Run `npm run lint` (which includes the typecheck) and report the real result. Never
  claim clean if it isn't.
- Exercise the feature if a dev server is available; otherwise say exactly what manual
  steps the user should run.
- **Never** `git add` / `commit` / `push` (Lucas commits).
- If the change touched the schema or migrations, confirm the local database is up to
  date and the client was regenerated.
- Docs: name every doc you updated; if the feature changes documented behaviour and you did
  not update the doc, say so under remaining gaps.
- Write the handoff using `references/handoff.md`, including the merge verdict line. It
  must include assumptions made in Phase 1 and anything the review loop escalated.

## Anti-patterns (things that get this workflow fired)

- Writing code before Phase 1's gate. — Guessing a money rule instead of reading the plan.
- Hand-rolling a helper that exists in the project's helpers or `components/ui`.
- Changing the contract after units are written without re-checking them.
- Reviewing the whole working tree instead of this task's diff. — Reviewing your own
  code generously.
- Reporting "done" without running lint. — Committing to git.
- Improvising subagent delegation here instead of switching to `orchestrate`.
