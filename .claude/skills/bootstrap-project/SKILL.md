---
name: bootstrap-project
description: Lead-developer workflow for starting a brand-new project or app from scratch — discovery questions, docs-before-code (rules, brand, architecture), scaffold in dependency order, then per-feature loops via build-feature. Use when creating a new repo, a new app alongside an existing one, or a greenfield product.
---

# Bootstrap Project — Greenfield Workflow

Building from scratch is the highest-ambiguity task an agent can get. The failure mode
is scaffolding for three hours against the wrong assumptions. So: **discovery → written
foundations → walking skeleton → features.** Code comes fourth, not first.

## Phase 1 — Discovery (ask, don't guess)

Ask the user these in one batch (skip any already answered by the request):

1. **Product:** who uses it, and what is the one workflow that must work in v1?
2. **Shape:** web app only, or web now and mobile later (keep the data layer reachable without the web UI)?
3. **Stack:** any hard requirements? For PocketPlan the approved plan in `docs/plan.md`
   decides; the default lean is one Next.js App Router + TypeScript + Tailwind + ShadCN
   app with server-side logic inside it, Postgres with Prisma or Drizzle, an auth library
   rather than hand-rolled sessions, Resend for email, and no separate backend unless a
   reason is written down.
4. **Auth & roles:** who logs in, and what are the 2–3 permission levels?
5. **Branding:** existing brand assets, or should we write a neutral guide (dark/light,
   fonts, status-color-only policy) and iterate?
6. **Deployment target:** where will this run? (affects env/config layout from day one)
7. **Non-goals:** what is explicitly OUT of v1?

**Gate:** you can write a one-paragraph product description the user agrees with.

## Phase 2 — Foundations as documents (before any code)

Create these files first; they are what keeps every future agent session in sync:

1. `docs/architecture.md` — apps/packages layout, data flow, auth model, key decisions
   with one-line rationale each.
2. `docs/brand.md` — tokens (bg/surface/border/text for light+dark), fonts, type scale,
   envelope colour palette, component conventions, Do/Don't list. Neutral chrome, colour
   = meaning (envelopes and status), mobile-first.
3. Agent rules in `.claude/CLAUDE.md` (already started): add the commands, ports, the
   error model, the money helper's name and the formatters once they exist, and keep
   "agents never commit".
4. `README.md` — how to install, run, and verify each app.

Show these to the user before scaffolding. Fixing a document costs one edit; fixing a
scaffolded assumption costs a rewrite.

## Phase 3 — Walking skeleton

Scaffold in dependency order, verifying each step runs before the next:

1. Repo + workspaces + TypeScript config + lint (`eslint` + `tsc --noEmit` wired into
   `npm run lint` per app from day one).
2. Database schema for the core entities only + first migration.
3. Backend: app bootstrap, error handler middleware + error classes, response envelope
   helper, auth, one real module (route → service → DB) end to end.
4. Frontend: layout with theme provider (light+dark), auth pages, API client wrapper,
   one real page consuming the real module.
5. Seed script so the app demos with data.

**Gate:** one workflow works end to end — login → see real data → mutate it → see the
change. Nothing else exists yet. That's correct.

## Phase 4 — Features

From here, every feature goes through the `build-feature` skill (clarify → architect →
delegate → review loop → verify → handoff). Update `docs/architecture.md` and the rules
files whenever a decision changes them — stale rules are worse than no rules, because
agents obey them confidently.

## Anti-patterns

- Scaffolding every entity/CRUD up front ("it'll save time later" — it won't; half will
  be wrong after the first user demo).
- Adding a second module before the first one works end to end.
- Writing rules/docs "later." Later never comes, and every agent session re-derives —
  and re-guesses — the conventions.
- Copying code wholesale from another project; copy the *shape* (module boundaries,
  response envelope, formatters, review loop), not the domain.
