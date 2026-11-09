# PocketPlan architecture

One Next.js 16 App Router app on Vercel. Server actions and route handlers are the backend. Postgres via Prisma 7 (`@prisma/adapter-pg`): Postgres 17 in Docker locally (`docker-compose.yml`, port 5436, databases `pocketplan` and `pocketplan_test`), Neon in production. Better Auth (email + password; password-reset links sent through Resend). Tailwind 4, no component library.

## Commands

| Command | Does |
|---|---|
| `npm run db:up` | start local Postgres 17 (`docker compose up -d --wait`) |
| `npm run db:migrate` | `prisma migrate deploy` against `DATABASE_URL` |
| `npm run dev` | dev server on :4100 (pages, server actions and API routes share this one port) |
| `npm run lint` | `eslint . && tsc --noEmit` (must pass before any handoff) |
| `npm test` | vitest; the envelope, ledger and reports tests hit `TEST_DATABASE_URL` (`pocketplan_test` locally) |
| `npx prisma migrate dev --name <x>` | create and apply a migration on the local database, regenerate client |
| `DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy` | bring the test database up to date |

Env: `.env.local` (never committed). Keys: `DATABASE_URL`, `TEST_DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`, `RESEND_FROM`. Read only inside `src/server`.

## Layout

```
src/app/            routes: pages, layouts, route handlers (api/auth/[...all], api/reports/preview)
src/components/ui/  shared presentational components
src/components/<feature>/
src/lib/            pure, framework-free, reusable by a future mobile app:
                    types.ts (shared types, ActionResult, ENVELOPE_COLOURS), money.ts (parseSen/formatSen),
                    dates.ts (ISO dates, Asia/Kuala_Lumpur), validation.ts (zod), auth-client.ts
src/server/         server-only (`import "server-only"` first line):
                    db.ts (Prisma), auth.ts (Better Auth + requireUser), errors.ts (AppError, toResult, insufficient)
                    lock.ts (lockUser + TX_OPTIONS), validate.ts (parseOrThrow)
                    envelopes/service.ts (incl. listEnvelopeNames: names only, no balance scan)
                    ledger/{balances,service,dates}.ts (dates: isoToDbDate / dbDateToIso for @db.Date)
                    reports/{build,render,send}.ts, email/send.ts
src/server/actions/ 'use server' files: requireUser → toResult(parseOrThrow → service) → ActionResult
prisma/             schema + migrations
tests/              vitest
```

## Data flow

Page (server component) → `requireUser()` → service read → render.
Client component → server action → `requireUser()` → `toResult(async () => { parseOrThrow; service })` → `ActionResult<T>` → toast/inline error.
`requireUser()` runs before `toResult` because its redirect is a thrown signal that `toResult` would swallow.

## Money rules (see docs/plan.md §3)

- Integer sen everywhere. `parseSen` at the input boundary, `formatSen` at the output boundary. No arithmetic on amounts in components.
- Balances are derived by one SQL query (`ledger/balances.ts`), never stored. Invariant `unallocated + Σ envelopes = total` holds by construction and is asserted in `tests/ledger.test.ts`.
- Allocation is a TRANSFER from `null` (unallocated). Every write runs in `db.$transaction` and first calls `lockUser` (`SELECT ... FOR UPDATE` on the user's `User` row), then checks the blocking rules against current balances read through the same transaction client.
- Every write transaction (ledger, envelopes, report-send reservation) passes `TX_OPTIONS` (maxWait 10 s, timeout 15 s).
- Envelope create, reorder, archive and unarchive take the same lock. Archive requires a zero balance; a void or unvoid that would leave an archived envelope non-zero is refused.
- Corrections are void/unvoid (`voidedAt`); rows are never edited or deleted. Voiding an EXPENSE voids its REFUNDs.

## Error model

`AppError(code, message)` with `ErrorCode` from `src/lib/types.ts`. Actions never throw to the client; `toResult` maps errors to `{ ok:false, code, message }`. Unknown errors are logged server-side and surfaced as "Something went wrong".

## Auth and ownership

Better Auth email + password (`src/server/auth.ts`): 8–128 characters, email verification required (link valid 24 h, sent on sign-up and again on an unverified sign-in, signs the person in when opened), reset tokens expire in 1 hour and a reset revokes every session. Settings → Account: change password (needs the current one, signs out other sessions) and change email (the current address approves, then the new address confirms; the email changes only after both). Pages: `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password` (each bounces a signed-in user to `/`); forms in `src/components/auth/` call `authClient` (`src/lib/auth-client.ts`, no plugins). Forgot-password always shows the same message, and Better Auth answers the same for unknown emails, so registered addresses are never revealed. Sign-up does not reveal a taken email either: with verification on, Better Auth answers a duplicate exactly like a new sign-up. Trusted origins: only `BETTER_AUTH_URL` in production; in dev also the serving origin and `x-forwarded-host`.

`requireUser()` reads the Better Auth session from request headers and redirects to `/sign-in` when absent. Every query on `Envelope`, `Transaction`, `ReportSend` includes `userId` from that session. Ids from the client are never trusted as proof of ownership.

## Email and reports

`src/server/email/send.ts` wraps Resend. When `RESEND_API_KEY` is missing outside production, emails (password-reset links) are printed to the server console (`shortcut:` dev only). In production `auth.ts` refuses to load without a `BETTER_AUTH_SECRET` of at least 32 characters.

Reports: `reports/build.ts` computes opening (day before start), activity and closing per envelope, plus Unallocated and Total rows, and asserts each row reconciles. `reports/render.ts` turns that into one email-safe HTML string (tables, inline styles, every user string escaped, no timestamps so the same data gives the same bytes).

- Preview: `GET /api/reports/preview` returns that HTML for an `<iframe sandbox="">`, with `Cache-Control: no-store` and `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'`. 401 without a session, 400 bad params, 404 foreign envelope.
- Send (`reports/send.ts`): build + render (same bytes as the preview) → in one locked transaction check the rate limit (3/min, 20/day, failed sends count), the duplicate guard (same content hash ACCEPTED within 10 min, or still in flight) and **reserve** a `ReportSend` row as `FAILED` with error "Sending did not finish" → commit → call Resend outside the transaction with the content hash as idempotency key → update the row to `ACCEPTED` + resend id, or `FAILED` + error. A crash mid-send leaves an honest FAILED row.
- The UI says "Accepted by email provider"; "delivered" is never shown.

## Decisions

- Prisma over Drizzle: Lucas knows Prisma. Raw SQL (always parameterised tagged templates) only in `ledger/balances.ts`, `reports/build.ts`, the single-statement envelope reorder and the row lock.
- No React Email: one `render()` returns an HTML string used for both the iframe preview and the Resend body, so the preview is exactly what is sent.
- Download PDF (Preview step): calls `print()` on the preview iframe (sandbox `allow-same-origin allow-modals`, never `allow-scripts`); the person picks Save as PDF. No server-side PDF library, so the PDF is the same HTML as the preview and the email.
- Dates stored as `DATE`; timezone fixed to Asia/Kuala_Lumpur for v1.
- `@types/node` is 24 to satisfy vite/vitest peer ranges.

## UI kit (added 2026-11-09)

- **shadcn/ui** (Radix, "Nova" preset, Lucide icons). `npx shadcn@latest add <name>` installs into `src/components/shadcn/` (set in `components.json`). App-specific primitives stay in `src/components/ui/`; the two folders exist so `ui/Button.tsx` and shadcn's `button.tsx` never collide on case-insensitive file systems.
- **Colour tokens use shadcn's names** (`background`, `foreground`, `card`, `primary`, `muted-foreground`, `destructive`, `border`, `ring`, …) in `src/app/globals.css`. Four themes (`modern` default, `premium`, `retro`, `pixel`) × mode (`system`/`light`/`dark`), saved per user in `Preference` and set on `<html data-theme data-mode>` by the root layout. Dark applies under `[data-mode=dark]`, or `[data-mode=system]` with `prefers-color-scheme: dark`; shadcn's `dark:` variant follows the same rule. Extra tokens: `chart-1..5`, `success`, `warning`. A theme changes the values, never the names. Quick toggle: `ModeToggle` in the top bar / side nav; full choice in Settings.
- **`cn`** comes from shadcn's `cn` package (class merging with Tailwind conflict resolution); `src/lib/cn.ts` and `src/lib/utils.ts` both re-export it.
- **Motion:** `framer-motion`. Animate transform and opacity only, and give every animation a `prefers-reduced-motion` fallback.
- **Design guidance:** the `ui-ux-pro-max` skill in `.claude/skills/` (from nextlevelbuilder/ui-ux-pro-max-skill). Its scripts only read bundled data.
- Claude Design brief: `docs/design/claude-design-brief.md`.

## v1.1 (added 2026-11-09): tabs, corrections, recurring, insights, health score

- **Navigation:** bottom bar (< 1024px) Dashboard / Activity / + / Envelopes / Insights; side nav at ≥ 1024px. Top bar: page title, light/dark toggle, Share report (`/reports`), Settings (`/settings`). Quick add is mounted once in the shell (`QuickAddProvider`); its envelope data comes from the `(app)` layout. `?add=expense|income|transfer` opens it on any page. `/history` permanently redirects to `/activity`.
- **Corrections (Edit):** `correctTransaction` voids the original and inserts a corrected copy with `correctsId` in one locked transaction, re-running the type's blocking checks against post-void balances. An expense with live refunds cannot be edited. `unvoidTransaction` refuses while any other version of the same entry is live (`liveVersion` walks the correction chain), so an entry never counts twice.
- **Recurring (`src/server/recurring/service.ts`):** reminders the user confirms; nothing posts automatically. Next due = `occurrenceDate(startOn, cadence, handledCount)`. `recordRecurring` / `skipRecurring` require `dueOn` = the current due date (DUPLICATE otherwise) and ≤ today; record inserts via the ledger's `insertIncome`/`insertExpense` (same rules) and increments `handledCount` in the same locked transaction. Start dates are limited to ±366 days of today.
- **Insights (`src/server/insights/service.ts`):** read-only; parameterised raw SQL aggregates bounded to ≤ 92 days (daily) and ≤ 13 months (monthly). `getDashboard`, `getEnvelopesInsights`, `getMonthInsights`, `getEnvelopeGrid`. Per-request dedupe via React `cache()`: `getCurrentBalances`, `listActiveEnvelopesCached` (read paths only; writes keep reading through their transaction client).
- **Health score (`src/lib/health.ts`, pure):** four parts × 0–25 (runway, envelopes at risk, buffer = unallocated + envelope surplus beyond pace until next income, spending vs income over 30 days; with no income it scores what you hold against two months of spending); bands healthy ≥ 75, watch 50–74, at risk < 50; null with no activity. Floats only for scores and ratios, never amounts.
- **Search:** Activity `?q=` matches merchant/note case-insensitively (LIKE wildcards escaped) or an exact amount.


## v1.2 removing money (2026-11-10)

Confirmed by Lucas: real delete for income entries and envelopes; comma as decimal; undo a whole split.

- `parseSen` (src/lib/money.ts) is the one amount parser: a comma is only a thousands separator ("1,000", "1,000.50"); "20,50", more than 2 decimals, a sign, an exponent or anything above MAX_SEN is null, never reinterpreted (Lucas, 2026-11-10, MYR convention). The server re-validates integers with `senSchema`.
- Server actions authenticate with `actionUser()` inside `toResult`: an ended session returns `UNAUTHORIZED` ("Your session ended, so this wasn't saved…") instead of redirecting and losing the action. Sessions slide: 30 days, refreshed daily.
- Envelope names are unique among active envelopes (case-insensitive, trimmed): create, rename and unarchive check under `lockUser`.
- Move back to Unallocated = TRANSFER with `toEnvelopeId` null (Activity: "Moved back · Name"); undo = void.
- `allocate` stamps one `batchId` on every row it creates; `undoSplit` voids the whole batch, refused if the money was spent.
- `deleteIncome` deletes the entry and all its correction versions, refused with the shortfall if Unallocated would go negative.
- `deleteEnvelope` moves the balance (logged transfer) to Unallocated or another envelope, saves name/colour/icon in `DeletedEnvelope`, stops repeats that spend from it, then deletes the row. Its past entries keep the id, show "Name (deleted)" via `listEnvelopeLabels`, and can't be voided, restored or edited (`assertEnvelopesExist`).

## Health score: monthly bills (2026-11-10)

Confirmed by Lucas: detect bills automatically. An envelope with at most one expense per calendar month over the last
90 days (`detectBill` in `src/lib/health.ts`), or one that a repeat spends from, is a bill: its next payment is expected a
month after the last (or at the repeat's next due date). A bill needs its amount before next income only if it falls due
by then; otherwise it needs nothing, so a paid, empty bill envelope is not "at risk". Day-to-day envelopes keep the
30-day pace model. The Dashboard reads 90 days of daily aggregates (was 60) for this.
- Quick add follows the URL: opening pushes `?add=<tab>`, so the browser Back closes it; closing from the sheet replaces the URL without `add`.
- Recurring items: the cadence can be edited; a change restarts the schedule from the current next due date (`startOn` = next due, `handledCount` = 0).
- `/dashboard` redirects to `/` (next.config). Health copy: runway over a year reads "over a year"; with no recurring income the detail says the month end is the horizon.
