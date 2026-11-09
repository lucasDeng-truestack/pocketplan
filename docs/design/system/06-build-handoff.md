# Build hand-off

What Claude Code needs to know to build the 2026-11-09 restructure. Design only here; nothing in the repository was changed. All defaults below were answered by Lucas on 2026-11-09.

## Confirmed by Lucas

- Bottom bar: Dashboard, Activity, + (Quick add), Envelopes, Insights, in that order with the + in the centre. Home is renamed Dashboard, History is renamed Activity.
- Dashboard shows an overview of past spending, cash flow and a score, anything that improves tracking.
- Activity holds every expense, income and recurring entry, for viewing and correcting.
- + records expenses, income and transfers (unchanged Quick add).
- Envelopes holds splitting and allocating money, plus reports on spending and income. Insights is its own tab for reading past spending and details, modelled on the reference (period total with change, 12-month chart, category movement, priciest day and small spends); see the InsightsScreen card.
- Theme choice and other account details live on Profile; Share report has its own entry point.
- A Health score shows spending and money risk.
- The theme is a per-profile setting (earlier decision).

## Answered by Lucas (2026-11-09)

1. Health score: keep the formula already in the build plan and in code (`src/lib/health.ts`: Runway, Envelopes at risk, Buffer, Spending vs income, 25 points each, softened by Lucas on 2026-11-09). The four signals in Screens section 15 and the HealthScore card are superseded; the card layout and bands still apply.
2. Recurring: in scope. The MVP is done, so this build is post-MVP; recurring entries and charts, both listed as out of the MVP in `docs/plan.md`, are now part of this work. Recurring stays a "Repeats monthly" flag with a reminder, never automatic recording.
3. Reports as the second segment of the Envelopes tab, with Share report buttons in the Dashboard and Insights headers: confirmed.
4. Dashboard hero stays Total remaining, net cash flow second: confirmed.
5. Profile behind the Dashboard avatar and the sidebar foot, not a tab: confirmed.

Nothing in this hand-off is still open.

## Status (2026-11-09)

The v1.1 build (`docs/handoff.md`) already delivered most of the work below: five-tab bar, Activity with corrections and recurring, Insights, health score, per-account themes. The v1.2 run closes the rest: Total remaining as the Dashboard hero, Reports as a tab inside Envelopes, the segmented spending bar, and the design system's theme colours.

## Work, in order

1. Routes and nav: `/dashboard`, `/activity`, `/envelopes?tab=…`, `/insights?tab=…&period=…`, `/profile`; redirects from `/` , `/history`, `/reports`. BottomNav gets five slots with the Quick add trigger in the centre; sidebars gain Insights and drop Reports and History.
2. Read models (server, pure functions over entries, integer sen): monthly spending and income per envelope for 12 months; total remaining series for the sparkline; spent-by-envelope for a period with the same figures for the previous period (the Insights deltas); priciest day and small-spend count for a period; the four health signals and the score. One test per function; the health score test covers each band.
3. Dashboard page: SummaryCard, CashFlowCard (with Week · Month · Year), SpendingChart, EnvelopeSplit, HealthScoreCard, RecentEntries. shadcn Chart for the sparkline and columns.
4. Activity page: search over merchant, note and formatted amount; chips as Toggle Group; day groups with net totals; existing TransactionDetailSheet unchanged.
5. Envelopes hub: Tabs with the segment in the URL; the existing EnvelopeManager and the existing ReportBuilder. Insights page: three tabs and the period control, both in the URL.
6. Profile page with the theme picker (already specified in the ProfileScreen card) and Sign out.
7. Recurring (confirmed): `recurrence` on entries (a schema migration), a Repeats badge, the Recurring filter, a reminder toast when due. Never records money automatically.
8. Sign in and sign up redesign (approved by Lucas 2026-11-09): follow `components/SignIn.md`, `components/SignInTablet.md` and `components/SignInDesktop.md`. Restyle `AuthLayout`, `SignInForm`, `SignUpForm` and the forgot and reset pages. Phone: logo and envelope fan, form on the background. Tablet: tinted band with an overlapping 480px card. Desktop (1024 and up): split screen with the brand panel on the left. Add the Sign in / Create account switch, move "Forgot password?" to the Password label row, make show/hide an icon button inside the field, and show a live 8-character check on sign up. Keep every auth call, error message and redirect as it is. The fan, total tile and trust points are decorative and `aria-hidden`.

## Out of scope, from the reference image

Ask (AI assistant), receipt scan, voice entry, investments, goals, accounts and cards, tags, split expense, a custom keypad (MoneyInput stays). Bank syncing and payments remain out as before.
