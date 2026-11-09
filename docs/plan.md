# PocketPlan – Envelope Budgeting MVP Plan

Status: **approved 2026-11-06; v1.1 built 2026-11-09** (see the v1.1 section at the end).

---

## Confirmed by Lucas

From the brief:

- Manual money tracking only. No bank sync, payments, receipt scanning, AI, multiple currencies or billing.
- MYR only. Money stored as integer sen, never floats.
- Mobile-first with a fast "record spending" path.
- Dashboard: total remaining, unallocated, per-envelope balances.
- Envelopes: create, rename, reorder, archive (never delete history), optional colour and budget target.
- Record opening money and income, allocate to envelopes, record expenses (amount, envelope, date, optional merchant/note), transfer between envelopes, view/filter history, correct mistakes, record refunds linked to the original expense.
- Balances carry over; nothing resets monthly.
- Invariant: unallocated + sum(envelope balances) = total remaining. Targets are goals, not funds. Users cannot allocate money they do not have. Corrections preserve history.
- Reports: date range + envelope selection; show spending, refunds, allocations, remaining balances; activity-in-period clearly separated from balance-as-of-end-date. Preview exact report, enter recipients, explicit Send. Private by default, option to omit notes. No scheduled emails.
- Resend server-side only, secret key, verified domain, ownership checks, rate limits, duplicate-send protection, clear error states. Never show "delivered" without delivery confirmation.
- Stack: Next.js, React, TypeScript, low-cost, no separate backend unless necessary.

From the Q&A (2026-11-06):

1. **Overspending:** reply was "Can I like the Overspending idea". Read as **yes, block overspending**. Correct me if you meant the warning option.
2. **Targets:** standing goal per envelope (one number, progress bar). No monthly concept.
3. **Auth:** Better Auth email + password (changed from magic link 2026-11-06).
4. **Hosting/DB:** Next.js on Vercel, Neon Postgres, **Prisma** (Lucas has used it throughout; Drizzle rejected).
5. **Report format:** a visual grid like the habit-tracker image (rows × columns, bordered cells, clean headings), made envelope-friendly. Not CSV.
6. **Backend shape (2026-11-06):** one Next.js app for the MVP, frontend and backend on one port (4100 locally) and one Vercel deployment. Business logic stays in `src/server` services and `src/lib`, framework-free, so it can move later.

## Suggested defaults (mine, not yet confirmed)

| Default | Why | Alternative |
|---|---|---|
| Private single-user accounts in v1 | Smallest data model; household sharing needs ownership/invite logic | Shared budgets in v2 (needs `budget` table between user and envelopes) |
| Email verification off until a Resend domain is verified | Verification mail could only reach the account owner without a domain | Turn on `requireEmailVerification` once the domain is live |
| Balance queries and `FOR UPDATE` locks written with Prisma `$queryRaw` / `$executeRaw` in a typed helper | Prisma `groupBy` cannot express the conditional sums; raw SQL in one file keeps the money logic readable | Drizzle (rejected: Lucas already knows Prisma) |
| Backend = Next.js server actions + route handlers | No separate service. Vercel runs them. | Separate API only if a non-web client ever appears |
| Balances derived by query, not stored | The invariant becomes an identity instead of something to maintain; "as of date" reports are the same query with a date filter | Cached balance columns (faster at scale, more bugs) |
| Corrections = void + re-enter, rows immutable | Preserves history and avoids double counting with the least code | Editable rows with audit log |
| Dates stored as DATE, timezone fixed to Asia/Kuala_Lumpur | MYR-only app; avoids timezone bugs | Per-user timezone later |
| Report HTML built by one server function; same string shown in preview (iframe `srcdoc`) and sent by Resend | Makes "preview the exact report" literally true | React Email (optional upgrade, not needed) |
| Tailwind + a few hand-rolled components | You know React; no component library to learn | shadcn/ui if speed matters more than bundle |

---

## 1. Product summary and MVP boundaries

PocketPlan is a mobile-first web app for envelope budgeting with manually entered money. A user records the cash they have, splits it into envelopes, logs spending against envelopes, and can email a clean report of a period to themselves or others.

**In MVP:** auth, envelopes (CRUD + reorder + archive + colour + target), income, allocation, expense, transfer, refund, void/correct, history with filters, dashboard, report preview + email via Resend.

**Out of MVP:** shared budgets, scheduled emails, delivery tracking via webhooks, recurring transactions, CSV export, charts beyond simple progress bars, PWA/offline, multi-currency, bank sync, payments, receipts, AI, billing.

**Success for v1:** Lucas uses it daily for a month on his phone and the dashboard total always matches what he actually has.

## 2. Main user flows and screens

Screens (all mobile-first, desktop is just wider):

1. **Sign up / Sign in / Forgot password / Reset password** – email and password; reset link by email (printed to the dev terminal without a Resend key).
2. **Dashboard** – total remaining, unallocated (tappable → allocate), envelope list with balance, colour swatch, target progress bar. Floating "+" button.
3. **Quick add sheet** – bottom sheet with tabs: Expense (default) / Income / Transfer. Amount keypad first, envelope chips, date (defaults today), merchant/note optional. Save returns to dashboard.
4. **Allocate** – from unallocated: list of envelopes with amount inputs, live "remaining to allocate" counter, Save disabled if over.
5. **Envelope detail** – balance, target, recent transactions for this envelope, Edit (name, colour, target), Archive.
6. **Envelopes manage** – reorder (drag or up/down), show archived toggle, create new.
7. **History** – list grouped by day; filters: type, envelope, date range; voided rows greyed. Tap row → detail with Void, Refund (expenses only).
8. **Report builder** – date range, envelope checkboxes, "include notes" toggle (off), Preview button.
9. **Report preview + send** – rendered report, recipients field (comma-separated emails), Send button, confirmation dialog, result state (accepted / failed).

Flows:

- First run: sign in → empty dashboard prompts "Record the money you have" → income → allocate → envelopes.
- Daily: open app → "+" → amount → envelope → Save (3 taps + amount).
- Payday: "+" → Income → amount → dashboard shows unallocated → Allocate.
- Mistake: History → row → Void → re-enter correctly.
- Refund: History → expense → Refund → amount (≤ remaining refundable) → envelope balance restored.
- Report: Reports → range + envelopes → Preview → recipients → Send → confirm → "Accepted by email provider".

## 3. Data model and money rules

Tables (plus Better Auth's own user/session tables):

```
envelope
  id, user_id, name, colour (nullable), target_sen (nullable),
  sort_order int, archived_at timestamp null, created_at

transaction
  id, user_id, type enum(income|expense|refund|allocation|transfer),
  amount_sen int > 0,
  envelope_id      nullable  -- expense/refund/allocation target
  from_envelope_id nullable  -- transfer source (null = unallocated)
  to_envelope_id   nullable  -- transfer target (null = unallocated)
  refund_of_id     nullable  -- refund → original expense
  occurred_on date, merchant text null, note text null,
  voided_at timestamp null, created_at

report_send
  id, user_id, sent_at, range_start, range_end, envelope_ids json,
  include_notes bool, recipients json, content_hash text,
  resend_id text null, status enum(accepted|failed), error text null
```

Allocation is modelled as a transfer with `from_envelope_id = null` (unallocated) → envelope. "Unallocate" is the reverse. One code path.

Balance rules (all over non-voided rows, `occurred_on <= as_of`):

- **Total remaining** = Σ income − Σ expense + Σ refund.
- **Envelope balance** = Σ transfers in − Σ transfers out − Σ expense + Σ refund (for that envelope).
- **Unallocated** = total − Σ envelope balances (equivalently: income − transfers out of null + transfers into null; both must agree, test it).
- Invariant holds by construction.

Blocking rules, checked server-side inside one DB transaction against the **current** balance:

- Expense > envelope balance → reject.
- Allocation > unallocated → reject.
- Transfer > source balance → reject.
- Refund: cumulative non-voided refunds for that expense ≤ expense amount → else reject.
- Voiding an income/allocation/transfer that would push any balance negative → reject with a message naming the envelope.

`shortcut:` blocking checks the current balance, not the balance on a backdated date. Upgrade if users backdate heavily.

Targets never affect any balance. Progress = balance / target, capped visually at 100%.

Archive: allowed only when balance is 0. Archived envelopes stay in history and reports, hidden from quick-add and dashboard.

## 4. Edge cases and acceptance criteria

Edge cases with a stated rule:

- Amount must be a positive integer in sen; UI accepts "12.50", server stores 1250. Reject 0 and negatives.
- Expense on an archived envelope → rejected. Refund to an archived envelope → **open decision** (block, or auto-unarchive).
- Void is reversible (unvoid) only if it would not violate a blocking rule.
- Refund of a voided expense → rejected. Voiding an expense with refunds → voids its refunds too, in the same DB transaction.
- Backdated entries change previously sent reports. Accepted; reports are snapshots of a moment.
- Renaming/recolouring an envelope affects historical display. Accepted.
- Concurrency: two expenses submitted at once on a thin balance. Run check + insert inside one transaction with `SELECT ... FOR UPDATE` on the envelope row.
- Report with zero envelopes selected → preview disabled. Range end < start → rejected.

Acceptance criteria (each becomes a test):

- After any sequence of operations, unallocated + Σ envelope balances = total remaining.
- Income raises unallocated and total by the same amount. Allocation moves money, total unchanged. Expense lowers envelope and total equally. Transfer leaves total unchanged. Refund raises envelope and total equally and is linked to its expense.
- Any blocked operation leaves the database unchanged and returns a message that names the envelope and the shortfall.
- Voiding never deletes a row; voided rows are excluded from every balance and report total.
- Each report row reconciles: opening + allocated in − moved out − spent + refunds = closing, and the Total row equals the dashboard total as of the end date.
- Report sent with "include notes" off contains no merchant or note text.
- Send button is disabled until recipients are valid and the preview is loaded; a second tap during an in-flight send does nothing.
- A user can never read, void, refund or report on another user's rows (every query filters by `user_id` from the session).

## 5. Illustrative walkthrough

1. Lucas signs in, records income RM 3,000.00 (300000 sen). Total 3,000, unallocated 3,000.
2. Allocates Food 600, Transport 200, Bills 1,200, Fun 300. Unallocated 700. Total still 3,000.
3. Buys lunch RM 18.50 from Food on 3 Nov, note "nasi lemak". Food 581.50, total 2,981.50.
4. Buys a jacket RM 150 from Fun, then returns it on 6 Nov: refund RM 150 linked to the expense. Fun back to 300, total 2,981.50.
5. Mistyped Grab ride RM 320 from Transport → blocked ("Transport has RM 200.00, short by RM 120.00"). Transfers 150 from Fun to Transport, re-enters RM 32.00. Transport 318, Fun 150. Total 2,949.50.
6. On 30 Nov builds a report for 1–30 Nov, envelopes Food + Transport + Fun, notes off. Preview shows the grid. Enters his own email and his partner's, confirms Send. Screen shows "Accepted by email provider", never "Delivered".

## 6. Architecture and implementation phases

Stack: Next.js (App Router) on Vercel, Postgres (Docker locally, Neon in production), Prisma (Better Auth's Prisma adapter + schema generator), Better Auth (email + password; reset emails via Resend), Tailwind, Resend SDK. Server actions for mutations, server components for reads, one route handler for the report HTML (so the preview iframe can load it). Vitest for money-rule tests against the local Docker test database.

Env vars: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`, `RESEND_FROM`. Never read in client components.

Phases (target 1–2 weeks):

1. **Auth + envelopes** – project setup, Better Auth email + password, envelope CRUD, colour, target, reorder, archive gate.
2. **Ledger + dashboard + quick add** – transaction table, balance queries, blocking rules in one transaction, dashboard, quick-add sheet, allocate screen. Money-rule tests land here.
3. **History + corrections** – history list and filters, void/unvoid, refunds with cap.
4. **Reports + Resend** – report query, HTML render function, preview iframe, recipients, send action with rate limit + idempotency, `report_send` log, error states. **Blocked on domain decision.**
5. **Polish** – empty states, loading states, mobile keypad, archived views, final invariant test pass.

Security boundaries (each is a test or a review check, not a hope):

- **Secrets stay server-side.** `DATABASE_URL`, `RESEND_API_KEY`, `BETTER_AUTH_SECRET` are read only in files under `src/server`. Any `NEXT_PUBLIC_` prefix on these is a build failure. Client components never import from `src/server`; enforce with `server-only` package imports.
- **Every server action re-checks the session.** Never trust a `userId` from the client. The action reads the session from cookies, and every Prisma query includes `where: { userId }`. A test calls each action with another user's envelope id and expects a not-found error.
- **Validate every input at the boundary** with Zod: amount is a positive integer in sen, dates are real dates, envelope ids are strings that belong to the caller, recipients are valid emails capped at 10.
- **Server actions are POST with origin checks** built into Next.js, which covers CSRF. Better Auth sessions use httpOnly, secure, sameSite cookies.
- **Database never faces the internet.** Neon only accepts SSL connections with the pooled connection string stored in Vercel env. No Neon Data API or public endpoint.
- **Money rules run in one DB transaction** with a row lock, so no race can push a balance negative or double-apply a refund.
- **Resend send path** is one server action: session check, ownership of the report data, rate limit, duplicate check, then send. Recipients are logged in `report_send` so abuse is auditable. The From address is fixed server-side; users cannot spoof it.
- **No raw user text in email HTML without escaping.** Merchant, note and envelope names are HTML-escaped in the render function. Test with a `<script>` envelope name.
- **Dependencies** kept minimal: Next.js, Prisma, Better Auth, Resend SDK, Zod, Tailwind. Run `npm audit` in CI.

Resend plan (nothing configured yet):

- Verified domain in Resend; `RESEND_FROM` like `reports@yourdomain`. Without a verified domain, Resend only sends to the account owner's address, so "email other people" does not work.
- Send happens only in a server action; the API key never leaves the server.
- Ownership: report data is built only from the signed-in user's rows. Recipients are free text by design (that is the feature).
- Rate limit: per-user cap per day counted from `report_send` (default 20) and a per-minute cap (default 3). Exceeding returns a clear message.
- Duplicate protection: hash of (range, envelopes, include_notes, rendered HTML, sorted recipients); same hash within 10 minutes is refused with "already sent, resend anyway?". Also pass Resend's `Idempotency-Key` header with that hash so a retried request cannot double-send.
- Status vocabulary in v1: `accepted` (Resend returned an id) or `failed` (error message stored and shown). The word "delivered" does not appear anywhere. Delivery/bounce tracking via signed Resend webhooks is phase 6+.
- Check Resend's current free-tier limits before phase 4; do not assume a paid plan.

## 7. Screens for Claude Design vs logic for Claude Code

**Claude Design brief (visual only, no logic):**

- Dashboard, Quick add sheet (expense/income/transfer tabs, keypad-first), Allocate screen, Envelope detail, Envelopes manage with reorder, History with filters and greyed voided rows, Report builder, Report preview + send with the confirmation dialog and accepted/failed states.
- **Report email**: translate the habit-tracker grid. Rows = one per envelope, then "Unallocated", then "Total". Column groups under two headers: "Activity 1–30 Nov" (Opening, +Allocated in, −Moved out, −Spent, +Refunds) and "As of 30 Nov" (Closing, Target, % of target). Colour as a small swatch cell beside the name. Optional transaction list below, only when notes are included. Title, subtitle with the period, footer "Sent from PocketPlan by <user email>".
- Email constraints: table layout, inline styles, max width 600px, system fonts only, no JavaScript, no background images, must read in Gmail mobile. The in-app preview shows the exact same HTML.
- Style direction: warm, calm, bordered grid like the reference image, envelope colours used sparingly.

**Claude Code brief (logic):** everything in sections 3, 4 and 6: schema, balance queries, blocking rules, void/refund rules, report query, render function, Resend action with limits, tests for the acceptance criteria.

## 8. Remaining decisions before implementation

1. **Domain for Resend** – do you own a domain you can verify? Blocks phase 4 for sending to other people.
2. **Private accounts in v1** – confirm (my default; your brief proposed it but it was not explicitly answered).
3. ~~Auth method~~ – decided: email + password (2026-11-06).
4. **Overspending** – confirm the reading "block" of your reply.
5. **Refund to an archived envelope** – block, or auto-unarchive.
6. **Rate-limit numbers** – 20/day and 3/minute are placeholders.
8. **Separate backend service (deferred, not rejected)** – trigger is the native mobile app, not "going to production". Step 1 then: versioned JSON API routes in the same Next.js app (`/api/v1/...`) with token auth, calling the same services. Step 2 only if needed: move `src/server` services into a separate API (for example NestJS) used by both web and mobile.


## v1.1 (2026-11-09): Dashboard, Activity, +, Envelopes, Insights

Confirmed by Lucas:
- Bottom bar: Dashboard / Activity / + / Envelopes / Insights (Insights added mid-build, modelled on his reference app).
- Recurring entries are reminders he confirms (shown as Due, tap Record); no automatic posting, no cron.
- Edit = replace and keep the old one: original voided, corrected copy linked, history shows "Corrected".
- Four themes (Modern, Premium, Retro, Pixel) × system/light/dark, saved on the account; plus a one-tap light/dark toggle.
- Health score: the 4-part formula (runway, envelopes at risk, buffer, spending vs income), each 0–25.
- Insights: browse past months, biggest expenses and top merchants, envelope drill-down, compare vs last month and vs the 3-month average.

Suggested defaults (mine, not confirmed):
- Settings and Share report live in the top bar (Settings in the side nav on desktop).
- Charts are hand-made SVG/HTML, no chart library.
- An expense with refunds can't be edited until they are voided; type never changes on edit.
- Recurring: monthly or weekly; monthly clamps to the month's last day; resume skips past occurrences; up to 100 items.
- Health inputs: 30-day window; next income = earliest due recurring income, else month end (at least 1 day); buffer target 10% of 30-day spending, min RM 50.

Confirmed by Lucas (2026-11-09, after the build): soften the health score.
- Buffer counts unallocated money plus each envelope's surplus beyond its 30-day pace until next income, so fully allocating is not penalised.
- Spending vs income with no income in 30 days (e.g. only an opening balance): scored on what you hold, full marks at two months of spending, instead of 0.
- Top merchants are gross of refunds (refunds carry no merchant).
- Left out from the reference: AI "Ask", receipt scan, accounts/tags, investments, split expense.
