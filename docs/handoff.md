# PocketPlan v1.3 — motion and envelope icons (2026-11-09)

- **Envelope icons:** migration `20261109092153_envelope_icon` adds `Envelope.icon` (nullable text, a key from `ENVELOPE_ICONS` in `src/lib/types.ts`, 24 Lucide icons). Picker in the envelope form; shown on a tint of the envelope colour in rows, chips, the envelope page, Allocate, Activity and recent lists. Charts, the 8-week grid and the email keep colour dots. Restart `pnpm run dev` after pulling (new Prisma client).
- **Motion (Framer Motion):** sliding pills on Quick add tabs, System/Light/Dark and the bottom bar and sidebar; Quick add forms slide by direction and the sheet glides between heights; every sheet slides up on open and down on close; theme and light/dark changes reveal as a circle from the tap point (View Transitions API; instant where unsupported); pages slide in from the side of the tab you moved to.
- **No loading screen:** `src/app/(app)/loading.tsx` is gone, so the current page stays while the next loads; the tapped tab pulses until it arrives.
- **Calm by design:** small offsets, no spring overshoot, and `prefers-reduced-motion` turns every movement into an instant change or a plain fade.
- Tests 89/89 (2 new for icons). Lint clean.

---

# PocketPlan v1.2.1 — optional envelope on spending (2026-11-09)

Confirmed by Lucas: an envelope is no longer required when recording spending ("floating" spending). Income already never took one.

- **Rule:** an expense with no envelope comes out of Unallocated. It is blocked when Unallocated is short, exactly like an envelope. The invariant (unallocated + envelopes = total) holds because balances are derived; `getUnallocatedDirect` now subtracts envelope-less spending too.
- **Refunds** of such an expense go back to Unallocated. **Corrections** can move an expense into an envelope (`envelopeId`) or out of one (`envelopeId: null`); `undefined` still keeps it.
- **Recurring** expenses may have no envelope; editing one can clear it (`null`).
- **UI:** Quick add, Edit and the recurring editor show an "Unallocated" chip, selected by default in Quick add. Spending works before any envelope exists (Transfer still needs one).
- **Readers:** Dashboard "Spent by envelope" and Insights "By envelope" show an Unallocated line (`unassignedSpentSen`, computed on the server). The email report counts it in the Unallocated row and lists those entries; before this, a report covering envelope-less spending would have failed to reconcile.
- **Tests:** 87 (5 new): unallocated spend, the shortfall block, refund to Unallocated, corrections in and out of an envelope, report reconciliation. The recurring test that required an envelope now checks the opposite.
- `scripts/seed-demo.mjs` adds three envelope-less purchases.

---

# PocketPlan v1.2 — design pass handoff (2026-11-09)

## What was built

The app now follows the design system in `docs/design/system/`. UI only: no server, lib, schema or test changes.

- **Dashboard:** Total remaining is the hero and comes first. Then envelope balances, net cash flow, In and Out, Spent by envelope as a segmented bar with named rows, Health, Due and Recent activity.
- **Envelopes:** two tabs, Envelopes and Reports. Reports moved inside Envelopes. The top-bar Share button still opens it.
- **Settings:** simpler. The duplicate Reports block is gone; report history lives on the Reports tab.
- **Themes:** all four themes (Modern, Premium, Retro, Pixel), light and dark, use the design system's colours. Every text and control pair meets AA contrast.
- **Small fixes from the logic session's list:** a corrected entry says "Corrected" on the Dashboard; envelopes without a colour are grey everywhere, charts included; Pixel shapes are square; Quick add caps a repeating start date at a year ahead.

## Changes

- `src/app/(app)/page.tsx`, `src/components/dashboard/` (`SpentBar.tsx` replaces `SpentDonut.tsx`; `CashFlowLine`, `DashboardSummary`, `InOutCards`, `RecentList`).
- `src/components/envelopes/EnvelopesTabs.tsx` (new); `envelopes`, `reports`, `settings` pages; `BottomNav.tsx` (Envelopes active on /reports); `TopBar.tsx`.
- `src/app/globals.css`: theme values from the design tokens; `--theme-pill-radius` per theme.
- `src/components/ui/ProgressBar.tsx` (track on `muted`), `src/components/charts/ColumnBars.tsx` (quiet gridlines), `src/components/charts/format.ts` (`envelopeColour(colour)`, one argument) and its callers in insights and envelopes.
- `src/components/ledger/QuickAddSheet.tsx`: date max with Repeats on.
- Docs: `docs/design/system/` (copied design system; `06-build-handoff.md` records Lucas's answers).

## Verified

- ✅ `npm run lint` clean; ✅ `npm test` 82/82.
- ✅ Contrast check over all 8 theme and mode pairs: 0 failures (5 values nudged from the design tokens, listed below).
- ✅ Headless Chrome on the dev server with seeded sample data, at 390×844 and 1280×800, in Modern light, Pixel dark, Retro light and Premium dark: Dashboard, Envelopes, Reports, Settings, Insights, Quick add. No horizontal scroll anywhere. The throwaway test users were deleted afterwards.

## Things I'm unsure about

- Five colours differ from the design tokens to pass contrast: Modern light ring `#78716c` and muted-foreground `#756e6a`; chart-1 in Modern light, chart-3 in Retro light and Pixel light darkened to reach 3:1.
- The desktop Dashboard grid shares rows across both columns, so with nine or more envelopes a gap opens under the Total remaining card.
- Pixel squares every round shape, including switch thumbs and the cash-flow end dot.

## Remaining gaps

- Not done (agreed): a link to a single Activity entry (needs `?entry=<id>` from the logic side); a bigger month selector on Insights.
- The Retro and Pixel 2px border and hard-shadow rules still reach non-matching theme previews inside Settings (pre-existing; the pill radius leak is fixed).
- The report email's muted text `#8a7a6a` in `src/server/reports/render.ts` differs from the design's `#75624f` (off limits for this run).
- Tablet (834) not screenshotted; Safari and Firefox not checked.

## Next steps

1. Open http://localhost:4100 at phone width and switch themes in Settings.
2. Commit when happy.

## Orchestration log

- **Plan:** UI-only, no contract change. Three units in parallel: Dashboard (`implementer-opus`), Envelopes · Reports and small gaps (`implementer-opus`), theme colours (`implementer-opus-high`; the plan table said `implementer-opus` for a high tier, corrected at spawn).
- **Review:** 8 findings in cycle 1 (5 from code review, 3 from the browser pass), one Opus fixer; 0 in cycle 2.
- **Routing:** no units on Sonnet (all UI), 4 on Opus, no escalations.
- **Orchestrator did directly:** the hand-off answer fix in `06-build-handoff.md`; two one-liners (cash-flow zero line colour, Insights link focus style); the desktop grid span swap after the screenshot pass.

---

# PocketPlan v1.1 — handoff (2026-11-09)

## What was built

The app now has five tabs: **Dashboard / Activity / + / Envelopes / Insights**. Settings, Share report and a light/dark toggle sit in the top bar, or in the sidebar on desktop.
- **Dashboard:** net cash-flow chart (Week, Month or Year), totals, envelope balances, In and Out, a spending donut, a health score (0–100 with four explained parts), recurring items due soon, and recent activity.
- **Activity:** search, filter chips, entries grouped by day with day totals, and **Edit**. Edit keeps the original, greyed out and marked "Corrected". Recurring reminders show as Due ×N with Record, Skip, Pause, Edit and Stop.
- **+ (Quick add):** keypad, envelope chips, and a Repeats toggle.
- **Envelopes:** your envelopes, Split money, Share report, and an 8-week spending grid.
- **Insights:** 12-month bars, any past month compared with last month and with the 3-month average, daily spending, an envelope drill-down, biggest expenses and top merchants.
- **Themes:** four themes (Modern, Premium, Retro, Pixel), each in light, dark or system mode, saved on your account.

## Changes

- **Schema:** migration `20261109071320_v11_activity_recurring_prefs`. Adds `Transaction.correctsId` and `Transaction.recurringId`, plus new tables `RecurringItem` and `Preference`.
- **Server:**
  - `ledger/service.ts`: `correctTransaction`; the unvoid guard over a whole correction chain; `q` search; shared `insert*` helpers.
  - New files: `recurring/service.ts`, `insights/service.ts`, `preferences/service.ts`.
  - New actions in `recurring.ts` and `preferences.ts`; `ledger.ts` gains `correctTransaction`.
  - `getCurrentBalances` and `listActiveEnvelopesCached` are deduped per request.
- **Lib:** `health.ts` (pure); new date helpers `occurrenceDate`, `addMonths`, `startOfWeek`, `startOfMonth`; new contract types and schemas.
- **UI:**
  - Shell: `AppShell`, `BottomNav`, `SideNav`, `TopBar`, `ModeToggle`.
  - Pages: `/activity`, `/insights`, `/settings`, and `/history` now redirects to Activity.
  - Restyled Quick add.
  - Component folders: `components/dashboard/*`, `components/insights/*`, `components/charts/*`, `components/settings/*`, `components/history/*`.
  - `globals.css` holds the token system for the 4 themes × light/dark.
- **Tests:** `health.test.ts`, `insights.test.ts`, `recurring.test.ts`, and a corrections block in `ledger.test.ts`. 81 tests in total, up from 42.
- **Health score softened (Lucas, after the build):** Buffer now counts envelope surplus beyond pace until next income; no recent income is scored on how long your money lasts (full marks at two months) instead of 0. Tests updated.
- **Docs:** `architecture.md` (v1.1 section), `plan.md` (v1.1 decisions), the design brief update, and `.claude/CLAUDE.md`.

## Run before using

- Restart the dev server after `prisma generate`. A running server keeps the old Prisma client, and the new tables then look missing.
- The migration is already applied to `pocketplan` and `pocketplan_test`.

## Verified

- ✅ `npm run lint` is clean.
- ✅ `npm test`: 81/81 pass. These cover the invariant after corrections and recurring records, a concurrent double record, the chained-unvoid double count, the health formula edges, the insights maths, and ownership.
- ✅ A headless Chrome walkthrough on the dev server, at 390×844 and 1280×800:
  1. sign up, create envelopes, record income, allocate, spend, and add a repeating bill;
  2. the dashboard total is right (RM 2,654.50) and the health score shows;
  3. editing an expense from 45.50 to 50 shows the original as Corrected and the total becomes RM 2,650.00;
  4. search finds the expense, the recurring list shows the bill, and Insights shows the merchants;
  5. Pixel dark survives a reload (`<html data-theme=pixel data-mode=dark>`);
  6. `/history?type=EXPENSE` redirects to `/activity?type=EXPENSE`;
  7. no page scrolls sideways at either width.
  The test accounts were deleted afterwards.

## Things I'm unsure about

- **Top merchants** are totalled before refunds (`insights/service.ts`).
- **Envelopes without a colour** show a grey dot in lists but a theme chart colour in charts.
- **Pixel theme:** round pills (chips, badges, the + button) stay round.
- **Dashboard "Recent activity"** labels a corrected original "Voided"; Activity says "Corrected". The file is `components/dashboard/RecentList.tsx`.
- **The In card on a narrow desktop column** wraps "RM / 3,000.00" onto two lines rather than clipping it.
- **The 12-month bars** are about 22 px wide on a phone. They are a shortcut; the ‹ › month picker is the 44 px target.

## Remaining gaps

- **Activity has no link to a single entry.** "Biggest expenses" links to an Activity search instead.
- **Recurring start dates beyond a year ahead** are rejected only on Save.
- **The visual design is not final.** It is still waiting for Claude Design.

## Next steps

- Paste the updated brief (`docs/design/claude-design-brief.md`) into Claude Design.

**Verdict (v1.1): ready to commit.** Lint is clean, 81/81 tests pass, review cycle 2 found nothing, and the browser walkthrough passed after the last change.

## Orchestration log

| Unit | Agent type | Tier | Cycles to clean | Notes |
|---|---|---|---|---|
| U1 corrections + recurring (server) | implementer-opus-high | high | 1 | Departed from the packet in three places: LIKE escaping, the chain unvoid guard, and a no-op resume. All accepted. |
| U2 insights + health + prefs (server) | implementer-opus-high | high | 2 | Resumed for `getMonthInsights` (the Insights tab was added mid-build). Fixer: per-request `cache()` dedupe; drill-down queries run in parallel. |
| U3 shell, themes, Settings, Activity, + | implementer-opus | medium | 2 | Resumed for the 5th tab, the light/dark toggle and the monthly-drift fix. Fixer: Settings stale mode, day totals across pages, backdated repeats. |
| U4 Dashboard + Envelopes + Insights UI | implementer-opus | medium | 1 | Resumed to build `/insights`. |

- **Review:** 8 findings in cycle 1 (5 correctness, 3 efficiency); 0 in cycle 2.
- **Routing:** no units on Sonnet (all UI or money), 4 on Opus, no escalations.
- **Orchestrator did directly:** the contract, migration, types, validation, date helpers and stubs; the recurring start-date bound; removing duplicate h1s; the danger-button contrast fix; envelope actions now revalidate the layout; the same income horizon for `healthLastMonth`; `preload: false` on theme fonts; explicit page grid columns; `relative` on the grid scroller (it was causing sideways page scroll); the In/Out and Unallocated wrapping; docs.
- **Fallback used:** none.

---

# PocketPlan MVP — handoff (2026-11-09)

## What was built

A mobile-first envelope-budgeting web app. You sign up with email and password, record income, split it into envelopes, record spending, transfers and refunds, cancel or restore entries without losing history, and preview and email a period report. The ledger never lets a balance go negative, and unallocated plus every envelope always equals the total remaining. It is one Next.js app. Local development uses Postgres in Docker; production is planned on Vercel with Neon.

## Changes

Greenfield: everything in the repo is new. Nothing is committed yet.

- `prisma/` — schema (Better Auth tables, `Envelope`, `Transaction`, `ReportSend`, `RateLimit`) and two migrations.
- `src/lib/` — shared types, money helpers (integer sen only), date helpers fixed to Kuala Lumpur, Zod schemas.
- `src/server/` — server-only code: auth, row lock, envelope service, ledger service and balance query, report build/render/send, email wrapper, server actions.
- `src/app/` — pages: sign up, sign in, forgot and reset password, dashboard, allocate, envelopes, envelope detail, history, reports; API routes for auth and the report preview.
- `src/components/` — UI primitives and feature components.
- `tests/` — 42 Vitest tests against the local test database.
- `docker-compose.yml`, `docker/init-test-db.sql` — local Postgres 17 on port 5436.
- `docs/plan.md`, `docs/architecture.md`, `docs/design/claude-design-brief.md`, `README.md`, `.claude/CLAUDE.md`.

## Run before using

Migrations are applied to both local databases (`pocketplan` and `pocketplan_test`) and the Prisma client is generated. Nothing else to run, apart from your `.env.local` holding the local URLs:

```
DATABASE_URL="postgresql://pocketplan:pocketplan@localhost:5436/pocketplan"
TEST_DATABASE_URL="postgresql://pocketplan:pocketplan@localhost:5436/pocketplan_test"
BETTER_AUTH_URL="http://localhost:4100"
```

Then `npm run db:up` (Docker Desktop must be running) and `npm run dev`. Restart `npm run dev` if it was running before 2026-11-07, since the Prisma client changed.

## Verified

- `npm run lint` ✅ (eslint + tsc, no errors)
- `npm test` ✅ 42/42 on local Docker Postgres, including the money invariant after every step of the plan's walkthrough, two concurrent expenses against one envelope, report row reconciliation, and the database rate-limit table.
- Schema: migrations up to date on both local databases; client regenerated ✅
- Browser ✅ Headless Chrome at 390 × 844 against the dev server on the local database, with email sending disabled. 14 steps passed with no browser errors: sign up → create Food, Transport, Fun → income 3,000 → allocate 600/200/300 → expense 18.50 → overspend 320 refused with "Transport has RM 200.00, short by RM 120.00" → refund 5 → void (refund voided too) → restore → dashboard shows total RM 2,981.50 = unallocated RM 1,900.00 + 581.50 + 200.00 + 300.00 → report preview renders → send to self shows "Accepted by email provider." and logs an ACCEPTED row. The test account was deleted afterwards.
- `grep -rni delivered src` → nothing ✅
- Docs updated: `docs/plan.md`, `docs/architecture.md`, `README.md`, `.claude/CLAUDE.md`, `docs/design/claude-design-brief.md`.

## Assumptions made

- Private accounts only, no sharing — the plan's default; revisit before a household feature.
- Overspending is blocked. The checks use the current balance, not the balance on a backdated date (`shortcut:` comment in the ledger service).
- A refund into an archived envelope is blocked with "Unarchive <name> first".
- Report send limits: 3 a minute, 20 a day, identical repeat refused for 10 minutes.
- Email verification is off until a Resend domain is verified. Until then an account can only send reports to its own address. Turning on `requireEmailVerification` lifts that automatically.
- Report email uses the Retro palette (cream, brown ink, gold rules) from your habit-tracker reference.
- After a password reset you are sent to sign in again rather than signed in automatically; Better Auth's reset creates no session.

## Things I'm unsure about

- Sign-in error copy in development shows the server status and code (for example `403 INVALID_ORIGIN`); production shows the plain message — see `src/components/auth/shared.tsx`.
- Development trusts whatever address the page is served from, to fix your `127.0.0.1` sign-in error; production trusts only `BETTER_AUTH_URL` — see `src/server/auth.ts`.
- The rate limit for sign-in only switches on in production. It is tested against the table, not against a deployed Vercel instance.
- The report preview is fetched and shown with `srcDoc` in an empty sandbox. It passed in headless Chrome; Safari is untested.

## Remaining gaps

- Escalated review findings: none. Three review rounds found 21 issues; all are fixed and the last round's six are covered by tests.
- Deferred scope (agreed): separate backend service (trigger: the native mobile app), shared budgets, scheduled emails, delivery tracking via Resend webhooks, email verification (needs a domain).
- Not verified: deployment to Vercel and Neon, a real Resend send (no API key yet), Safari and Firefox, keyboard-only use of the sheets.

## Next steps

1. Click through the app yourself at http://localhost:4100 on your phone width.
2. Commit (message below).
3. Send `docs/design/claude-design-brief.md` to Claude Design and apply the chosen theme to `src/app/globals.css` and the components.
4. Add a Resend API key, then verify a sending domain and turn on email verification.
5. Deploy: create the Vercel project, set the env vars from the README, and run `prisma migrate deploy` against Neon.

## Orchestration log

| Unit | Agent type | Tier | Cycles to clean | Notes |
|---|---|---|---|---|
| 1 Auth (magic link) + shell + UI primitives | implementer-opus-high | high | 1 | a second interactive session overwrote files mid-run; Lucas stopped it; orchestrator fixed `cacheComponents` and removed `instant` exports |
| 2 Envelopes | implementer-opus-high | high | 1 | review checkpoint 1: 8 findings, all fixed |
| 3 Ledger + invariant test | implementer-opus-high | high | 1 | orchestrator added `TX_OPTIONS` |
| 4 Dashboard, quick add, allocate | implementer-opus-high | high | 1 | orchestrator fixed sign-out variant, stable `onClose`, toast offset |
| 5 History, void, refund | implementer-opus-high | high | 1 | review checkpoint 2: 7 findings, fixed in one fixer pass |
| 6 Reports + Resend | implementer-opus-high | high | 1 | reserve-then-send design accepted |
| 7 Polish + docs | implementer-opus-high | medium | 1 | orchestrator added `TX_OPTIONS` to envelope writes |
| 8 Email + password (replaces magic link) | implementer-opus-high | high | 1 | Lucas's change of direction |
| Final fixer pass | implementer-opus-high → orchestrator | high | 1 | agent stopped on Lucas's pause; orchestrator finished the reports screen, tests, and a stale-preview message bug |

Review: 8 findings at checkpoint 1, 7 at checkpoint 2, 6 at the final review; 0 open.
Routing: 0 units sonnet, 8 opus, 0 escalations. One agent for every unit, as Lucas asked, so UI units ran at the high tier instead of medium.
Orchestrator did directly: scaffold, Neon project, Docker Postgres, schema and both migrations, shared types and helpers, port move to 4100, dev-only trusted origins, small fixes listed above, and the browser check.
Fallback used: none.

## Suggested commit message (covers the MVP and v1.1; nothing is committed yet)

```
feat: PocketPlan envelope-budgeting MVP with v1.1 tabs and insights

Next.js app with email + password auth, envelopes, an integer-sen ledger
(income, allocation, expense, transfer, refund, void/restore), history,
and period reports emailed through Resend. Balances are derived by one
query so unallocated + envelopes = total always holds; writes are
serialised per user with a row lock. Local Postgres 17 in Docker.

v1.1: Dashboard / Activity / + / Envelopes / Insights tabs, edit by
correction (original voided and linked), recurring reminders the user
confirms, a 4-part health score, month insights, and four themes with
light/dark saved per account.
```

Ready to commit.
