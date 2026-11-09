---
name: orchestrate
description: Multi-agent build workflow for Claude Code — the current model orchestrates (plan mode, questions, frozen contract, validation, review loop, handoff) and subagents implement and fix — Opus 5.5 for judgement and all UI/UX work, Sonnet 5.5 for mechanical, fully specified units — each at an effort tier the orchestrator assigns via the implementer-* agent types in .claude/agents/. Packages plan mode + build-feature + /code-review into one command. Use for any feature, refactor, or module that spans more than a couple of files, whenever the user says "orchestrate", "spawn agents", "use subagents", "build this with Opus", or wants a plan approved before code is written. Requires the Agent tool; in Cursor or single-agent sessions, use build-feature instead.
---

# Orchestrate — lead + Opus/Sonnet implementers

You are the **orchestrator**. You never write implementation code yourself beyond the
data contract and tiny fixes. You plan, decide, route each unit to the right model,
delegate, validate what comes back, run the review loop, and hand off. The value you add
is judgement at the gates; the value the implementers add is throughput inside a frozen
contract — Opus where judgement is still needed inside the unit, Sonnet where the
packet has removed it.

This skill **wraps** three things and adds the glue between them:

| Wrapped | How | Where its content lives |
|---|---|---|
| Plan mode | `EnterPlanMode` at the start, `ExitPlanMode` as the single approval gate | harness |
| build-feature | Follow its phases; reuse its context list, question list, delegation packet, review checklist, handoff template | `.claude/skills/build-feature/SKILL.md` + `references/` |
| code-review | Invoke the `code-review` skill each review cycle; its findings feed the fixers | built-in skill |

Do not copy content from build-feature into your packets from memory. Open the
reference files and paste from them. They are the source of truth and they change.

**Project rules that apply throughout:** never `git add`/`commit`/`push` (Lucas commits).
Database migrations apply to the local database only, with the project's own migration
tool. Never claim lint is clean without running it. Money is integer sen and the balance
invariant holds after every write (`.claude/CLAUDE.md`).

## Roles

| Role | Agent type | Owns | Never does |
|---|---|---|---|
| Orchestrator | you | Context, questions, plan, contract, routing, validation, running review, handoff | Implementation units; fixing review findings itself (except one-line fixes cheaper than a packet) |
| Explorers | `Explore` | Read-only fan-out during plan mode | Edits |
| Implementers | `implementer-opus-high` / `implementer-opus` / `implementer-sonnet` | One unit each, against the frozen contract, at the tier and model the plan assigned | Touching the shared types, the database schema, or another unit's files |
| Fixers | same three types, chosen by the most severe finding | Applying a verbatim findings list | Widening scope, refactoring unrelated code |

The three implementer types are custom agents in `.claude/agents/` (Opus at high
reasoning effort, Opus at medium, Sonnet at medium). Which one a unit gets is decided by
two independent choices written in the plan: the **effort tier**
(`references/effort-tiers.md`) and the **model routing** (`references/model-routing.md`).
The short version of routing: Opus by default and always for UI/UX, money, ownership,
auth, schema and performance work; Sonnet only for units that are mechanical,
have an exact analog, can be specified file by file, and fail loudly. If a session does
not list the `implementer-*` types, fall back to `general-purpose` with `model: "opus"`
or `model: "sonnet"` and say so in the orchestration log.

## Run state (survives context compaction)

Long runs get summarised mid-flight. Keep a `run-state.md` in your scratchpad from
Phase A onwards and update it at every phase gate: baseline paths, the plan file path,
the Units table with agent type, model, agent ID and status, every "unsure" item and its
resolution, findings per review cycle, escalations. After a compaction, re-read it
before acting; never reconstruct state from memory. The handoff's orchestration log is
built from it.

## Phase A — Plan mode (read-only until approved)

1. **Record the baseline.** Before anything else, save `git status --porcelain` and
   `git diff --stat` to your scratchpad. The tree may carry unrelated uncommitted
   work; you need the baseline to scope the review to *this* run's changes later.
2. Call `EnterPlanMode`.
3. Do build-feature **Phase 0** (context) yourself: `.claude/CLAUDE.md`,
   `docs/plan.md` (the approved product plan), `docs/architecture.md`, and any design
   notes for the screen (Claude Design hand-offs live under `docs/design/`).
   Spawn `Explore` agents in parallel for fan-out questions ("closest analog for X end to
   end", "where is the balance for Y computed"). Read the analog feature yourself — the
   contract depends on it and you cannot delegate the contract.
4. Do build-feature **Phase 1** (clarify). Answer from the repo what you can. Ask the rest
   with `AskUserQuestion` in **one batch**. If the user is unavailable, choose the most
   conservative option, write the assumption into the plan, and repeat it in the handoff.
5. Write the plan to the plan file the plan-mode system message names. Required sections:
   - **Goal** — two sentences: what will exist, how the user confirms it works.
   - **Frozen contract** — schema, shared types, endpoints or server actions (name,
     auth requirement, input, output shape). Paste, don't describe.
   - **Units** — one row each: name, app, files to create/modify, effort tier with its
     one-line reason, **agent type** (`implementer-opus-high` / `implementer-opus` /
     `implementer-sonnet`) with the one-line routing reason, depends-on. Mark which units
     run in parallel (disjoint file sets, both depend only on the contract). Size units
     to one agent's context: one app, a file set you can list in full, and a packet you
     can write without "etc." — split anything larger. Large runs get a trailing
     **docs** unit (Sonnet-eligible) from a spec you write.
   - **Orchestrator-owned work** — contract, migration, anything you will do yourself.
   - **Verify strategy** — lint, the money-invariant test, the manual flow on a phone
     width, browser check if a dev server is available.
   - **Assumptions** — everything you chose without the user.
   Write the plan yourself. The plan-mode harness suggests spawning `Plan` agents; they are
   optional here because you own the contract. Spawn one only when two designs are
   genuinely in play and you want a second opinion on the trade-off.
   Before freezing the contract, re-check every number, count, file attribution, and
   version string in it against the raw output it came from (lint log, `npm view`, grep).
   A wrong fact in the contract is copied faithfully into every packet and only surfaces
   as an agent's "unsure" item or a review finding, both of which cost a cycle.
   Before freezing a Sonnet route, re-check it against the eligibility list in
   `references/model-routing.md`; if any rule fails, move the unit to `implementer-opus`
   now — re-routing after a failed Sonnet run costs more than the Sonnet run saved.
6. Call `ExitPlanMode`. This is the only approval gate. Nothing is written before it,
   and after it you run to the handoff without stopping unless the review loop caps out.

## Phase B — Contract (you, not an agent)

Implement the frozen contract exactly as approved: database schema, migration applied
locally and the client regenerated, shared types, route or action signatures. If implementing the contract reveals it must change,
change it now, update the plan file, and only then spawn units. A contract that changes
after agents start is the most expensive mistake in this workflow.

## Phase C — Implement (Opus and Sonnet agents)

For each unit, build a packet from `references/agent-packets.md` (which itself embeds
build-feature's `references/delegation.md` template plus the effort-tier block). Sonnet
packets additionally carry the per-file instructions, stop conditions and "what done
looks like" from the Sonnet addendum — if you cannot write those bullets, the unit is
not Sonnet-eligible. Spawn all parallel-safe units in **one message** so they run
concurrently. Dependent units wait. Record each agent's ID and type in `run-state.md`.

While agents run, do not poll and do not start implementing yourself. Agents run in the
background and the harness notifies you when one reports; never predict or paraphrase a
result you have not received. When one reports:

- **Sonnet unit:** check its report and `git diff --stat` against the packet's per-file
  bullets first, before anything else. A missed instruction (wrong path, missed file,
  lint not run) gets **one** correction via `SendMessage`. A judgement gap — invented
  shape, changed copy, "improved" neighbouring code, or an "unsure" that is not a typo in
  your packet — gets no correction: re-spawn the unit on `implementer-opus` with the same
  packet plus the Sonnet report under `## Prior attempt (do not trust, do not repeat)`,
  and log the escalation.
- If it reports uncertainty, resolve it yourself. An agent's guess never becomes a
  silent decision.
- If it missed the contract or touched files outside its set, send the exact gap back
  to the **same** agent with `SendMessage` (it keeps its context) and wait.
- If it reports a lint failure it could not fix, that is your problem now, not the
  reviewer's: decide whether it is a contract bug (fix in Phase B terms) or a unit bug
  (send back).

## Phase D — Validate (you)

Not a code review yet. Check the whole diff against the plan:

- Every path, shape, field name, and enum value matches the frozen contract.
- Only the planned files changed. Diff against the Phase A baseline to see this run's
  footprint; anything outside the plan is either reverted or added to the plan with a
  reason.
- Every "unsure" item from every agent has an explicit resolution.
- Mechanical checks pass: `npm run lint`, plus the grep block in build-feature
  `references/review-checklist.md` §1.
- **UI units:** if the preview tools are available, start the dev server, open each
  changed screen at a phone width (and desktop), and look at it before the review.
  Layout and hierarchy problems that the greps cannot see are cheaper to catch here
  than in a review cycle. Note what you saw, or that you could not, in `run-state.md`.

Only when Phase D is clean does the diff earn a code review. Reviewing a diff that does
not match its own plan wastes the review.

## Phase E — Review loop (code-review → fixers)

One cycle:

1. Invoke the `code-review` skill via the `Skill` tool at level `high`, targeting the
   paths this run touched (scoping matters because of the unrelated uncommitted work).
   Do not pass `--fix`; fixes go to agents.
2. Add project-specific findings the generic review cannot know: walk build-feature
   `references/review-checklist.md` §2–§5 against the diff (ownership, money invariant,
   history preservation, Resend guards, bounded queries, indexes).
3. Merge into one numbered list with `file:line`, ordered by the checklist's severity
   discipline (correctness → ownership/security → convention → style). Drop findings you
   verified are false positives and say why in your notes. For every finding, state the
   expected fix in one clause; a finding you cannot phrase that way is a design question
   for an Opus fixer, not a Sonnet one.
4. Zero findings → exit the loop. Otherwise spawn one **fixer** per touched layer (server, UI) with the
   fixer packet from `references/agent-packets.md`: findings verbatim, contract, file
   set, "fix only these". Route by the most severe finding in that fixer's list:
   `implementer-opus-high` for any correctness, ownership or security finding;
   `implementer-sonnet` only when every finding is convention or style tier with the fix
   stated; `implementer-opus` otherwise. Fixers run in parallel when their file sets are
   disjoint.
5. When fixers return, re-run lint and the greps, then re-review **only the changed
   lines**. That is the next cycle's input.

Cap at **3 cycles**. If findings survive cycle 3, stop. Do not ship them quietly and do
not run a fourth cycle: list them in the handoff under escalated findings and let the
user decide. A style nit surviving cycle 3 is a note; an ownership leak or a broken
money invariant surviving cycle 3 means the handoff says "do not merge".

## Phase F — Verify and hand off

- `npm run lint`. Paste failures verbatim if any.
- If a dev server is running and the browser tools are available, exercise the flow
  and say what you saw. Otherwise write the exact manual steps.
- Schema touched → migrations applied locally, client regenerated.
- No git commands.
- Write the handoff with build-feature `references/handoff.md` (unsure-about, remaining
  gaps, next steps and the merge verdict live there) plus the orchestration log from
  this skill's `references/handoff.md`, which names the agent type per unit and ends
  with the routing line (units on Sonnet, on Opus, escalations and why).
  Two escalations in one run means the routing rule was wrong for this feature class;
  say which rule, so `references/model-routing.md` can be tightened.

## Anti-patterns

- Writing any implementation before `ExitPlanMode` returns approved.
- Delegating the contract, or letting a unit "just add a field" to shared types.
- Spawning implementers one at a time when they are parallel-safe.
- Routing a unit to Sonnet because it is *small*. Size is not the criterion; mechanical,
  fully specified and loud-on-failure is. UI/UX work is never Sonnet, however small.
- Writing a Sonnet packet that says "make X work" instead of "in file F, do Y".
- Giving a Sonnet unit a second correction instead of escalating to Opus.
- Spawning `general-purpose` when the `implementer-*` types are listed — you lose the
  per-tier reasoning effort.
- Running `code-review` on the whole working tree when the tree has unrelated changes.
- Fixing review findings yourself because it feels faster. One-liners only.
- A fourth review cycle. A ✅ on lint you did not run. "Known gaps: none" you did not earn.
- Acting after a context compaction without re-reading `run-state.md`.
