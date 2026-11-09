---
description: Plan the PocketPlan envelope-budgeting MVP as a product partner. No code until the plan is approved.
---

Act as my product partner. Help me plan an envelope-budgeting web app before I hand an approved plan to Claude Code. Do not write code or scaffold anything yet. Challenge unnecessary complexity and keep the MVP achievable in 1–2 weeks.

If `docs/plan.md` exists, read it first and resume from the latest open decision instead of starting over.

THE IDEA
People manually record the money they have, then divide it into envelopes such as Food, Transport, Bills and Fun. When they record spending, the amount is deducted from the chosen envelope. They can create their own envelopes and email spending reports to themselves or other people using Resend.

This tracks money; it does not hold funds, connect to banks or make payments.

CORE EXPERIENCE
- Mobile-first, with a quick way to record spending.
- Dashboard showing total money remaining, unallocated money and envelope balances.
- Create, rename, reorder and archive envelopes, with optional colours and budget targets.
- Record opening money and new income, then allocate it into envelopes.
- Record an expense with amount, envelope, date and optional merchant/note.
- Move money between envelopes without treating it as spending or income.
- View and filter transaction history, correct mistakes and record refunds.
- Keep unused envelope balances until spent or moved; do not reset them automatically each month.

MONEY RULES
Use MYR initially and store money as integer sen, never floating-point values.

Income increases unallocated money. Allocation moves money into an envelope without increasing the total. Spending reduces both the envelope balance and total remaining money. Transfers do not change the total. Refunds restore money to the original envelope and remain linked to the expense.

Unallocated money plus all envelope balances must equal total remaining money. Targets are goals, not additional funds. Corrections must preserve history and avoid double-counting. Do not let users allocate money they do not have.

Propose blocking overspending by default, but ask whether I prefer a warning that allows negative envelope balances. Explain the consequences. Archive envelopes rather than deleting their transaction history.

REPORTS AND RESEND
Users choose a date range and which envelopes to include. Show spending, refunds, allocations and remaining balances, clearly distinguishing activity during the period from balances as of the end date.

Let users preview the exact report, enter recipients and explicitly confirm Send. Keep reports private by default and let users omit personal transaction notes. No scheduled emails in v1.

Plan Resend integration server-side only, with the API key kept secret. Include verified-domain setup, authenticated sending, ownership checks, rate limits, duplicate-send protection and clear error states. Do not label an accepted email as delivered without delivery confirmation. Do not send or configure anything during planning.

SCOPE AND TECH
Proposed starting point: private user accounts, each managing their own envelopes. Shared household budgets can come later—confirm this assumption with me.

I know Next.js, React and TypeScript. Recommend a simple stack and database, explaining tradeoffs without adding a separate backend unnecessarily. Prefer low-cost options; do not assume paid plans are required.

Exclude bank syncing, actual payments, receipt scanning, AI features, multiple currencies and subscription billing from the MVP.

HOW TO WORK WITH ME
First ask up to five questions that materially affect the product, then wait for my answers. Separate my confirmed requirements from your suggested defaults.

After my answers, produce:
1. A clear product summary and MVP boundaries.
2. Main user flows and screens.
3. A simple data model and money rules.
4. Important edge cases and acceptance criteria.
5. One illustrative walkthrough from income to allocation, spending, refund and report.
6. Recommended architecture and implementation phases.
7. Screens to send to Claude Design, separately from logic for Claude Code.
8. Remaining decisions before implementation.

Write the finished plan to `docs/plan.md` with a "Confirmed by Lucas" section and a "Suggested defaults" section kept apart. Do not start implementation until I approve the plan.

$ARGUMENTS
