# PocketPlan

Envelope-budgeting app. People record the money they have, divide it into envelopes
(Food, Transport, Bills, Fun, their own), record spending against an envelope, and email
spending reports to themselves or others through Resend.

It tracks money. It never holds funds, connects to banks or makes payments.

## Where we are

**Building.** Plan approved 2026-11-06 (`docs/plan.md`); stack and layout in `docs/architecture.md`.
Commands: `npm run db:up` (local Postgres 17 in Docker on port 5436, databases `pocketplan`
and `pocketplan_test`), `npm run dev` (port 4100), `npm run lint` (eslint + tsc), `npm test`
(vitest, DB tests use `TEST_DATABASE_URL`). Migrations: `npx prisma migrate dev --name <x>`, then
`DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy` for the test database. Local dev uses
Docker Postgres, not Neon; Neon is for production only. Agents never commit.

## Skills and agents in this folder

- `/plan-product` holds the planning brief (commands/plan-product.md).
- `/bootstrap-project` once the plan is approved: foundations as documents, then a
  walking skeleton, then features.
- `/orchestrate` for any feature spanning more than a couple of files: plan mode, a
  frozen contract, implementer agents (`agents/implementer-*`), review loop, handoff.
  Keep it to a handful of agents; credits matter.
- `/build-feature` for the single-agent path on smaller changes.
- Review rules for this project live in `skills/build-feature/references/review-checklist.md`.

## Product in one screen

- Mobile-first web app (Next.js, React, TypeScript). A native mobile app comes later, so keep
  business logic out of React components and behind a clean API from day one.
- Dashboard: total remaining, unallocated, each envelope's balance, cash flow, health score (v1.1).
- Tabs (v1.1): Dashboard / Activity / + / Envelopes / Insights; Settings (themes) and Share report in the top bar.
- Envelopes: create, rename, reorder, archive, delete (Lucas, 2026-11-10: real delete; balance moves out first,
  past entries keep the name via DeletedEnvelope and are frozen). Optional colour and
  budget target. Targets are goals, not funds.
- Money in: opening balance and income raise unallocated money. Allocation moves money into
  an envelope without changing the total.
- Spending: amount, envelope, date, optional merchant and note. Reduces the envelope and the
  total.
- Transfers between envelopes change neither the total nor spending.
- Refunds restore money to the original envelope and stay linked to the expense.
- Activity (was History): view, search, filter, edit by correction (original voided and linked), recurring reminders the user confirms.
- Unused envelope balances carry over. Nothing resets monthly.
- Reports: date range plus a choice of envelopes. Show spending, refunds, allocations and
  closing balances, separating activity in the period from balances at the end date. Preview
  the exact email, type recipients, confirm Send explicitly. Private by default; notes can be
  omitted. No scheduled emails in v1.

## Money rules (non-negotiable)

- MYR only. Store amounts as integer sen. Never a float anywhere in the money path.
- Invariant: unallocated + sum of envelope balances = total remaining. Every write must keep
  it; put a test on it.
- Users cannot allocate money they do not have.
- Overspending: block by default. Whether to allow negative envelope balances with a warning
  is an open decision for Lucas, with consequences spelled out.
- Corrections preserve history and never double count. Exception confirmed by Lucas 2026-11-10: income entries can
  be permanently deleted (all versions), refused while that would make Unallocated negative. Prefer reversing entries over editing
  amounts in place.

## Resend (email reports)

Server-side only. API key stays secret. Plan for a verified sending domain, authenticated
sending, ownership checks on every envelope included, rate limits, duplicate-send protection
and clear error states. "Accepted by Resend" is not "delivered"; never show delivered without
a delivery event. Do not send or configure anything during planning.

## Out of the MVP

Bank syncing, real payments, receipt scanning, AI features, multiple currencies,
subscription billing, shared household budgets (private accounts first, confirm with Lucas),
scheduled emails.

## Stack guidance

Lucas knows Next.js, React and TypeScript. Prefer one Next.js app with server-side logic
(route handlers or server actions) over a separate backend, unless a reason is written down.
Low cost by default: do not assume paid plans. Keep the MVP achievable in 1 to 2 weeks and
challenge anything that threatens that.

## How to work with Lucas

- Ask up to five questions that materially change the product, then wait. Do not pad with
  questions that have a sensible default.
- Keep "confirmed by Lucas" separate from "suggested default" in every plan and summary.
- Explain tradeoffs in plain words; recommend one option rather than listing all.
- Screens go to Claude Design as a separate hand-off from the logic given to Claude Code.
- Commit only when asked. Never add "Co-Authored-By: Claude" or "Generated with Claude Code"
  lines to commits or PRs.
- Use subagents sparingly; this is a small project and credits matter.
