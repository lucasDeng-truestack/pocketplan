# Effort tiers

"Effort" has two parts. The **tier** is what the packet tells the agent to do before it
reports done: how much to read, how much to verify, how much to write back. The
**reasoning effort** is the model's own thinking budget, set in the custom agent
definitions under `.claude/agents/` (frontmatter `effort:`); the Agent tool has no
per-call effort knob, so the tier picks the agent type:

| Tier | Agent type (`subagent_type`) | Model | Reasoning effort |
|---|---|---|---|
| high | `implementer-opus-high` | Opus 5.5 | high |
| medium | `implementer-opus` | Opus 5.5 | medium |
| low, judgement or UI involved | `implementer-opus` | Opus 5.5 | medium |
| low or medium, mechanical and fully specified (`references/model-routing.md`) | `implementer-sonnet` | Sonnet 5.5 | medium |

If a session does not list these agent types (the definitions live in `.claude/agents/`
and load at session start), fall back to `subagent_type: "general-purpose"` with
`model: "opus"` or `model: "sonnet"`; reasoning effort then follows the user's model
settings and you lose the high tier's extra thinking, so say so in the orchestration log.

Pick the tier per unit and write the one-line reason in the plan. When in doubt, go
one tier up: an over-worked unit costs tokens, an under-worked unit costs a review cycle.
The tier never decides the model — routing does. A high-tier unit is always Opus; a
low-tier unit is Opus unless it passes every Sonnet-eligibility rule.

## Choosing

| Tier | Use when | Typical units |
|---|---|---|
| **low** | Mechanical, one file or one pattern, an exact analog exists to copy | Docs update, adding a column to an existing table component, wiring an existing endpoint into an existing page, renaming |
| **medium** | Several files in one layer, some judgement, but no money, ownership, or schema logic | New page + components against an existing endpoint, new route + service that is CRUD-shaped, form with validation |
| **high** | Any of: money rules and the balance invariant, user ownership, auth, schema-adjacent code, the Resend send path, concurrency, migration of existing data, anything the review checklist §5 cares about | Allocation and spending writes, refunds and corrections, report sending, dashboard totals, auth changes |

Fixers inherit the tier of the most severe finding they are fixing: an ownership finding
makes the fixer high even if the unit was medium.

## What each tier says in the packet

Paste the matching block into the packet's `## Effort` section.

### low

```
## Effort: low
- Mirror the analog file(s) named above exactly; do not explore beyond the listed files
  and the rules docs.
- Run `npm run lint` before reporting.
- Report in under 10 lines: files changed, one line per decision, anything unsure.
```

### medium

```
## Effort: medium
- Read the analog feature end to end (route → service → API client → page → component)
  before writing anything, and the rules docs named above.
- Before coding, list the edge cases you will handle (empty, loading, error,
  not signed in) in your notes; handle all of them.
- After coding, re-read your own diff once against build-feature
  references/review-checklist.md §2 or §3 (whichever is your side) and fix what you find.
- Run `npm run lint` before reporting.
- Report: files changed, decisions made with the reason, edge cases covered,
  anything you were unsure about (be honest — the orchestrator resolves these, and an
  unflagged guess is worse than a flagged one).
```

### high

```
## Effort: high
- Read the rules docs named above in full, then the analog feature end to end.
- Before coding, write down in your notes: the invariants this code must hold
  (unallocated + envelopes = total, integer sen, user ownership, history preserved),
  the edge cases, and the failure paths. Design the change against that list first.
- Money only as integer sen via the money helper. Every query on a user-owned table
  filters by the signed-in user's id from the session, never from the request.
- Every list query you add or touch is bounded or justified in a comment.
- After coding, review your own diff against build-feature references/review-checklist.md
  §2–§5 as if you were a hostile reviewer; fix what you find and list what you fixed.
- Run `npm run lint`. If the money-invariant test or another test applies to what you
  changed, run it and paste the result.
- Report: files changed, invariants and how each is enforced, edge cases covered,
  what you self-reviewed and fixed, and anything you are unsure about. Do not smooth
  over uncertainty.
```
