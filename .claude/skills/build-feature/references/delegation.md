# Delegation — the unit packet and the parallel-safety rule

This file holds the two things both skills share: what a unit packet must contain, and
when two units may run side by side. **Who** executes a unit is decided elsewhere:

- `build-feature` (single agent): you execute every unit yourself, in order, and write
  the packet as your own working notes so the review has something objective to check.
- `orchestrate` (Claude Code with the Agent tool): the orchestrator writes the packet and
  spawns an `implementer-*` agent per unit. Agent type, model and effort tier come from
  `.claude/skills/orchestrate/references/model-routing.md` and `effort-tiers.md`; the
  full spawn packet (role, effort block, hard limits, report format, Sonnet addendum) is
  in `agent-packets.md` there. Do not improvise delegation outside orchestrate.

## Why delegation fails (and how to prevent it)

Subagents share **nothing** with you: no conversation history, no rules you've read,
no decisions you've made. Every failure mode of delegation is a missing sentence in
the packet. Write packets as if onboarding a competent contractor on day one. The same
discipline makes a single-agent run reviewable: a unit without a packet cannot be
checked against anything but your own memory.

## Parallel-safety rule

Two units may run in parallel **only if** their file sets are disjoint and both depend
only on the frozen contract. Server and UI units qualify once schema + shared types +
route signatures are done and written into the plan. Two units editing the shared types
or the schema never qualify.

## The unit packet (required sections)

```
## Task
One paragraph: what to build and the definition of done.

## Contract (frozen — do not change)
- Endpoints / server actions: name — auth requirement — input — output shape
- Types: paste the shared types or their exact file location
- Schema: paste the relevant models (lead applies the local migration and regenerates the client)

## Files
- Modify: exact paths
- Create: exact paths
- Do NOT touch: anything outside these (especially the shared types and the schema)

## Conventions (do not rediscover — obey)
- Read .claude/CLAUDE.md and docs/architecture.md first; docs/plan.md holds the approved product rules
- Mirror this existing feature: <path to the closest analog you found in Phase 0>
- Money: integer sen only, through the money helper; the invariant unallocated + envelopes = total holds after every write
- Ownership: every query filters by the signed-in user's id from the session
- Server: logic in services, handlers orchestrate; errors through the project's error model
- UI: the API client wrapper; shared formatters; existing components/ui; mobile-first

## Verify before reporting done
- npm run lint must pass
- Report: files changed, decisions made, anything you were unsure about
```

## After a unit is done

Do not trust "done" — yours or an agent's. The unit's result enters the Phase 4 review
loop as an untrusted diff checked against this packet. If anything was flagged as
uncertain, resolve it explicitly before the review; never let a guess become a silent
decision.
