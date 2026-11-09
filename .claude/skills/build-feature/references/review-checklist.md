# Review checklist — PocketPlan

Run mechanical checks first (cheap, objective), then read the diff. Report findings as
a numbered list with file:line; fix, then re-review only the fixes.

The exact commands and helper names come from `docs/architecture.md` once the stack is
chosen. Until then, treat the names below as "the project's equivalent".

## 1) Mechanical checks

```bash
# Type + lint (wire both into `npm run lint` from day one)
npm run lint

# Money in the diff: any float or raw arithmetic on an amount is a finding
git diff | grep -nE '^\+.*(amount|balance|total|target|sen).*(parseFloat|toFixed|Number\(|\* ?1\.|/ ?100|\.[0-9]+ ?\*)'
git diff | grep -nE '^\+.*\b(amount|balance|total)\b.*[+\-*/]'   # must go through the money helper

# Dates: no locale-dependent formatting outside the shared formatter
git diff | grep -nE '^\+.*toLocale(Date|Time)?String'

# Debug leftovers
git diff | grep -nE '^\+.*(console\.log|debugger|TODO: remove)'
```

## 2) Server review

- [ ] Ownership: every query on user-owned tables (envelopes, transactions, reports,
      report sends) filters by the signed-in user's id from the session, never from the
      request body or params.
- [ ] Auth: every route handler or server action checks the session before touching data.
- [ ] Money: integer sen everywhere; the invariant (unallocated + envelope balances =
      total remaining) is held by the write path and covered by a test.
- [ ] No negative balances unless the plan's overspending decision allows them, and then
      only where the decision says.
- [ ] Corrections and refunds create new entries linked to the original; nothing edits an
      amount in place or deletes history. Archive, never delete.
- [ ] Errors use the project's error model and reach the user as a message, not a 500.
- [ ] Validation (Zod or the chosen library) on every input; enum values from the shared
      types.
- [ ] Resend: called server-side only, key from env, recipient list validated, ownership
      checked on every envelope included, rate limit and duplicate-send guard present,
      "accepted" never shown as "delivered".
- [ ] Schema changed? Migration applied locally and the client regenerated; command
      written in the handoff.

## 3) UI review

- [ ] API calls go through the project's client wrapper; no raw `fetch` to our own routes.
- [ ] Failures reach the user (toast or inline), never only the console.
- [ ] Amounts and dates render through the shared formatters; the UI never does sen
      arithmetic.
- [ ] Mobile-first: changed screens checked at a phone width first; the quick "record
      spending" path is reachable in two taps from the dashboard.
- [ ] Reuses existing `components/ui` and feature components; no duplicate widget.
- [ ] Loading, empty, and error states exist for every data fetch.
- [ ] Both themes if the project ships dark mode: colours via semantic tokens.
- [ ] Forms: schema validation, inline errors, submit disabled while pending.
- [ ] Business logic lives in the shared or server layer, not in the component: the
      mobile app will reuse it later.

## 4) Cross-cutting

- [ ] Matches the plan's contract exactly (paths, shapes, field names).
- [ ] No leftover debug, commented-out blocks, unused imports.
- [ ] Naming matches neighbouring code (compare with the analog named in the packet).
- [ ] Every "unsure" from the implementer has an explicit resolution.
- [ ] Sends an email? Template and copy live with the other report templates; the send
      is logged with status; nothing is sent during tests.

## 5) Performance and data

- [ ] No unbounded loads: every list query is paginated or bounded, with a stable order.
- [ ] Dashboard totals come from one query or a maintained balance, not from loading
      every transaction on each render.
- [ ] New foreign keys and filtered columns are indexed; user-owned tables index
      `[userId, …]`.
- [ ] Independent fetches on one page run in parallel.

## Severity discipline

Order findings: correctness → ownership/security → convention → style.
A style nit never blocks handoff on cycle 3; a money invariant or ownership leak always does.
