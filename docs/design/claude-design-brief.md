# PocketPlan — Claude Design brief

Paste everything below the line into Claude Design. It describes screens, content and states only. The logic already exists in code; the design must not add features.

---

> **Update 2026-11-09 (v1.1 is built; this section overrides anything below that conflicts).**
> - Navigation is now **Dashboard / Activity / + / Envelopes / Insights** (bottom bar on phone, sidebar at 1024 px and up). "Home" is now Dashboard and "History" is now Activity. Reports are reached from a **Share** icon in the top bar; **Settings** (theme, light/dark/system, account, sent reports) is a gear in the top bar, and a sun/moon icon toggles light and dark.
> - **Dashboard:** net cash-flow line with Week / Month / Year, Total remaining + Unallocated, envelope balances, In / Out cards, a Spent-by-envelope donut, a **health score** card (0–100, Healthy / Watch / At risk, expands to 4 parts: Runway, Envelopes at risk, Buffer, Spending vs income), Due soon (recurring), Recent activity.
> - **Activity:** search, chips All / Expenses / Income / Transfers / Recurring, entries grouped by day with day totals, REPEATS badge, entry detail with **Edit** (the original stays, marked Corrected), Void, Restore, Refund. Recurring view: Due ×N badges, Record, Skip, Pause/Resume, Edit, Stop.
> - **+ (Quick add):** Expense / Income / Transfer tabs, big amount + keypad, envelope chips, Date / Merchant / Note rows, a **Repeats** toggle (Monthly / Weekly).
> - **Envelopes:** your envelopes (reorder, archive), Split money, Share report, the 8-week spending grid.
> - **Insights:** Spending / Income / Cash flow 12-month bars (tap a month), month picker, compare vs last month and 3-month average, daily spending, By envelope with drill-down (spent vs target, 6 months, expenses), Biggest expenses, Top merchants, Priciest day, Small spends.
> - The four themes are now real in code (`<html data-theme=modern|premium|retro|pixel data-mode=system|light|dark>`), using the token names in this brief plus `chart-1..5`, `success`, `warning`. Design every screen in Modern light first, then show each theme on Dashboard and Insights.

## What PocketPlan is

PocketPlan is a mobile-first envelope-budgeting web app for one person. You record the money you actually have, split it into envelopes (Food, Transport, Bills, Fun, or your own), and spend from those envelopes. It tracks money; it never holds it or connects to a bank. Currency is Malaysian ringgit, shown as `RM 1,234.56`.

The one feeling it must give: **"I know exactly where my money is, and recording a purchase takes three seconds."**

## Design goals

1. **Fast capture.** Recording an expense is: tap "+", type the amount, tap an envelope, tap Save. Nothing may slow this down.
2. **Numbers you trust.** Amounts are the largest, clearest thing on every screen. Tabular figures. Never truncate an amount.
3. **Calm, not gamified.** No confetti, no streaks, no red alarm screens. Colour is meaning: envelope colours identify envelopes, red only for errors and money leaving.
4. **Phone first, but at home on tablet and desktop.** Start every screen at 390 × 844, then give tablet and desktop their own layouts that use the extra space (see "Responsive layout"). A stretched phone column on a 1440 px monitor is a failure.
5. **Accessible.** Tap targets at least 44 px on touch screens. Text contrast WCAG AA in light and dark. Every icon button has a visible or spoken label.

## Theme directions

Produce **four directions** for the dashboard and quick-add sheet first, side by side, before designing every screen. Each direction needs light and dark.

| Direction | Mood | Type | Shape and texture | Envelope colours |
|---|---|---|---|---|
| **Pixelated** | A tidy 8-bit wallet. Playful but readable. | Pixel display font for headings and big amounts only (e.g. "Press Start 2P" or "Silkscreen"); a plain sans for body and inputs | Square corners, 2 px hard borders, stepped shadows, pixel-grid dividers. Envelope icon drawn as pixel art. | Saturated retro palette, flat fills |
| **Retro** | 1970s paper ledger and passbook. Warm and analogue. | Serif headings (e.g. "Fraunces"), monospace amounts | Cream paper `#faf7f2`, brown ink `#4a3b2f`, gold rule lines `#c9a96e`, subtle grain, ruled rows like an account book | Muted earthy tones |
| **Modern** | Clean fintech. Confident, neutral. | One geometric sans (e.g. "Geist" or "Inter"), tabular numbers | Soft 12–16 px radii, hairline borders, generous whitespace, no texture | The current palette below |
| **Premium** | Private banking. Quiet luxury. | High-contrast serif for amounts (e.g. "Instrument Serif"), refined sans for UI | Deep near-black or ivory surfaces, thin metallic accent lines, restrained motion | Desaturated jewel tones |

Recommend one and say why. The current build uses the **Modern** direction with neutral stone colours (shadcn "Nova" preset, Geist font, Lucide icons).

Current envelope palette (users pick one per envelope; a theme may remap these 8 slots but must keep 8 distinct, accessible colours):
`#E07A5F` `#F2CC8F` `#81B29A` `#3D405B` `#6A994E` `#BC4749` `#8E7DBE` `#4A90A4`, plus "no colour" (neutral grey).

Deliver tokens per direction **using exactly these names** (they are the CSS variables the code already reads; a theme is a new set of values, never new names):

| Token | Used for |
|---|---|
| `background` / `foreground` | Page background and main text |
| `card` / `card-foreground` | Cards, list containers, sheets |
| `popover` / `popover-foreground` | Menus, selects, toasts |
| `primary` / `primary-foreground` | Main buttons, the "+" button, selected tab |
| `secondary` / `secondary-foreground` | Secondary buttons |
| `muted` / `muted-foreground` | Quiet surfaces / secondary text, captions, labels |
| `accent` / `accent-foreground` | Hover and pressed states |
| `destructive` | Errors, "Void entry", money-out amounts |
| `border`, `input`, `ring` | Dividers, input borders, focus ring |
| `radius` | One base radius; sm, md, lg, xl, 2xl are derived from it |

Plus, outside that set: the 8 envelope colours, font families (sans, heading, mono for amounts if you want one), shadow, and the type scale (amount-xl, amount-lg, heading, body, small). Every token needs a light value and a dark value. Dark mode follows the phone's system setting; there is no in-app toggle.

## What the build uses (design for these, so the hand-off maps 1:1)

**Components: shadcn/ui** (Radix primitives, "Nova" style). Draw every control as its shadcn counterpart so implementation is a direct mapping, not a reinterpretation:

| In this brief | shadcn component |
|---|---|
| Buttons (primary, secondary, ghost, danger) | Button (`default`, `secondary`, `ghost`, `destructive`, `outline`) |
| Text, date and money fields | Input + Label (money field = Input with an "RM" prefix inside the box) |
| Bottom sheets (Quick add, entry detail, envelope form, confirms) | Drawer on phone; Dialog on tablet and desktop, or a side Sheet / inline pane where the layout section says so |
| Expense / Income / Transfer switcher | Tabs |
| Envelope chips | Toggle Group (single choice) |
| Envelope pickers in Transfer, History filters | Select |
| Report envelope list, "Include notes" | Checkbox / Switch |
| Summary card, list containers | Card |
| "Voided", "Archived", send status | Badge |
| Target progress | Progress |
| Toasts | Sonner |
| Loading states | Skeleton |

Icons: **Lucide** only (no emoji, no other icon sets). Give every icon-only button a label.

**Motion: Framer Motion.** Specify motion for each item below with duration and easing, so it can be built as written:
- Sheets slide up from the bottom (spring), backdrop fades; closing reverses.
- Toasts slide and fade in above the "+" button; auto-dismiss.
- Tabs: the selected-tab highlight slides between tabs (shared layout).
- Envelope list: rows animate to their new position when reordered (layout animation).
- Amounts on the dashboard tick to their new value after a save (short count-up, under 400 ms).
- Allocate: "Left to allocate" changes colour smoothly when it goes negative.
- Buttons: subtle press feedback (scale ~0.97).
Rules: animate only transform and opacity (never width or height); 150–250 ms for small UI changes, up to 400 ms for sheets; motion must mean something (no decorative loops); every animation has a `prefers-reduced-motion` fallback that is instant or a plain fade.

**Quality bar: the UI UX Pro Max checklist.** The design must pass these, in this priority order:
1. Accessibility: text contrast at least 4.5:1 (3:1 for large amounts) in light and dark; visible focus rings; never colour alone to carry meaning (money out also has a "−" sign).
2. Touch: every tap target at least 44 × 44 px with 8 px between targets; visible pressed and loading states.
3. Layout: mobile-first, no horizontal page scroll at any width (the report email table is the only allowed scroller), readable line lengths on wide screens (prose under ~75 characters), respect phone safe areas around the bottom nav and "+" button.
4. Style consistency: one direction applied everywhere; semantic tokens only, no raw hex inside components except envelope colours.
5. Typography: body at least 16 px, nothing under 12 px, line height about 1.5, tabular figures for every amount.
6. Forms: visible labels (never placeholder-only), errors next to the field they belong to, helper text where a rule exists.
7. Navigation: 4 destinations at every size (bottom nav on phone, sidebar on tablet and desktop); back always goes where the user expects; deep links work (a History filter or an open entry survives a refresh).
8. Pointer and keyboard (tablet with keyboard, desktop): visible hover states, every action reachable by keyboard, logical tab order, Escape closes any sheet or dialog.

## Responsive layout

Three breakpoints. Design every screen at each one.

| Size | Width | Frame to draw | Navigation | Quick add |
|---|---|---|---|---|
| Phone | under 640 px | 390 × 844 | Bottom tab bar | Floating "+" → bottom Drawer |
| Tablet | 640–1023 px | 834 × 1194 portrait, plus 1194 × 834 landscape for Home and History | Collapsed icon sidebar (labels on hover and focus), expandable | "+ Add" button in the top bar → centred Dialog |
| Desktop | 1024 px and up | 1280 × 800 and 1440 × 900 | Full left sidebar with labels, the user's email and Sign out at the bottom | "+ Add" button in the top bar → centred Dialog; keyboard shortcut **N** when no text field has focus |

Per-screen layout on tablet and desktop:

- **Home:** summary cards across the top (Total remaining, Unallocated with Allocate), then the envelopes as a responsive grid of cards (2 columns tablet, 3–4 desktop). On desktop, a right-hand "Recent entries" panel (last 8 entries) sits beside the grid.
- **Quick add:** same three tabs; envelope chips can sit in a wider grid. Keyboard: Enter saves, Escape closes, arrow keys move between tabs when a tab has focus (no number-key shortcuts: the amount field has focus and digits must type).
- **Allocate:** a two-column table (envelope with balance and target on the left, amount input and "Fill to target" on the right). The "Left to allocate" summary becomes a sticky side panel on desktop instead of a footer.
- **Envelopes:** a table-like list with columns (name, balance, target with progress, actions). Reorder by drag handle on pointer devices; keep up/down buttons for keyboard. The edit form opens in a right-hand side Sheet.
- **Envelope detail:** balance, target and actions on the left; recent entries on the right.
- **History:** a master–detail layout. Filters sit in a bar above the list (they collapse behind a "Filters" button on phone). The list takes the left two-thirds; selecting an entry opens its details, void and refund actions in a right pane instead of a sheet. On desktop the list gains columns: date, label, envelope, amount, status.
- **Reports:** builder on the left, live preview on the right at desktop width, so changing a choice re-renders the preview beside it. Send always sends exactly the preview on screen; while a new preview is loading, Send is disabled. The recipients and send step sits under the builder. Recent sends become a small table below.
- **Sign in, sign up, password pages:** a centred card (max ~420 px) on a calm full-page background; on desktop, an optional quiet left panel with the product's one-line promise.
- **Empty and error states:** centred in the content area at every size, never stretched edge to edge.

Content width: cap reading content (forms, sheets, text) at about 640 px, and data views (dashboard grid, History table) at about 1200 px, centred, with comfortable side margins.

## App shell

On phone:

- Bottom tab bar, fixed: **Home**, **Envelopes**, **History**, **Reports**. Active tab clearly marked.
- A floating **"+" button** (56 px, bottom right, above the tab bar) on Home that opens Quick add.
- Toasts appear above the "+" button, auto-dismiss (bottom-right corner on tablet and desktop). A toast can carry one action link (e.g. "Income added." · **Allocate**).

## Screens

For each screen, design the default state plus every state listed.

### 1. Sign up
Title "PocketPlan", one line "Track the money you have, one envelope at a time." Fields: Email, Password (show/hide toggle), Confirm password, helper "At least 8 characters". Button "Create account". Link "Already have an account? Sign in".
States: field errors ("Passwords don't match"), "An account with this email already exists. Sign in instead.", submitting.

### 2. Sign in
Email, Password with show/hide, button "Sign in", links "Forgot password?" and "New here? Create an account".
States: "Email or password is incorrect", "Too many attempts. Wait a minute and try again.", submitting.

### 3. Forgot password / Reset password
Forgot: email field, button "Send reset link", then the confirmation "If an account exists for that email, we sent a reset link."
Reset: New password, Confirm, button "Set new password". States: "Password updated", "This reset link has expired. Request a new one."

### 4. Home (dashboard)
- Header row: "PocketPlan" and a quiet "Sign out".
- Summary card: **Total remaining** (largest number on the screen), then a row **Unallocated RM x** with "Allocate →" when above zero.
- Envelope list: colour swatch, name, balance on the right, and a thin target progress bar under rows that have a target.
States:
- **First run:** no envelopes and no money: card "Start by recording the money you have" with buttons "Add income" and "Create envelopes".
- **Envelopes but none funded:** "You have RM x to put into envelopes. Allocate".
- **Envelope at zero** and **envelope over its target** (bar full).
- Long envelope name (truncate the name, never the amount).

### 5. Quick add (bottom sheet)
Title "Quick add". Segmented control: **Expense** (default) · **Income** · **Transfer**.
- **Expense:** huge amount field with "RM" prefix and numeric keyboard, auto-focused. Envelope chips in a wrap grid (swatch, name, small balance), none preselected. Date (defaults today). "Add details" reveals Merchant and Note. Button "Save expense".
- **Income:** amount, date, optional note, "Save income".
- **Transfer:** amount, From (Unallocated or an envelope, with balances), To, "Save transfer".
States: Save disabled until valid; inline server error above Save, e.g. **"Transport has RM 200.00, short by RM 120.00"**; "Create an envelope first" when none exist; submitting.

### 6. Allocate
Header "Allocate", "Unallocated RM 700.00". One row per envelope: swatch, name, current balance, amount input, "RM x to target" hint and a "Fill to target" button when below target. Sticky footer: **Left to allocate RM x** (turns red when negative) and "Save".
States: over-allocated (negative, Save disabled), nothing entered, no envelopes.

### 7. Envelopes (manage)
Title + "New envelope". List rows with swatch, name, balance, target bar, and up/down reorder buttons. "Show archived (n)" reveals greyed archived rows with "Unarchive".
Sheet "New envelope" / "Edit envelope": Name, colour picker (None + 8 swatches as round radio buttons), Target (optional, RM), helper "A goal for this envelope. It does not move any money."
States: empty list, archived list open.

### 8. Envelope detail
Back link, swatch + name (+ "Archived" badge), balance large, target bar and "Target RM x". Buttons Edit and Archive/Unarchive. "Recent entries" list (same rows as History) with "See all".
States: archive confirm ("It disappears from your dashboard and quick add. Its history stays. Only an empty envelope can be archived."), archive refused ("Move RM 12.50 out of Food first"), not found.

### 9. History
Filters row: Type (All, Expenses, Income, Refunds, Transfers), Envelope, From date, To date, "Clear filters". List grouped by day headings ("6 Nov 2026"). Row: swatch, label, signed amount.
- Expense: merchant or envelope name, **−RM 18.50**.
- Income: note or "Income", **+RM 3,000.00**.
- Refund: "Refund · Fun", **+RM 150.00**.
- Transfer / allocation: "Fun → Transport", "Allocation → Food"; amount unsigned and muted (it moves money, total unchanged).
- Voided: faded, amount struck through, "Voided" badge.
- Expense with refunds: small "Refunded RM 50.00" under the label.
"Load more" at the bottom; "Showing older entries · Back to latest" on later pages.
States: nothing recorded, no matches, invalid filters note.

### 10. Entry detail (sheet)
Title = kind (Expense, Income, Refund, Transfer, Allocation). Definition list: Amount, Date, Envelope or From/To, Merchant, Note, "Refunded RM x of RM y", Voided date. Buttons: "Record refund" (expenses), "Void entry" (danger) or "Restore entry".
- Void confirm sheet: "This entry stops counting. It stays in your history and you can restore it." (+ "Its refunds are voided too.")
- Refund form: amount prefilled with what's refundable, date, note; "You can refund up to RM x".
States: server refusal inline (e.g. "Voiding this would leave Fun at −RM 150.00"), success toast.

### 11. Reports
Three steps on one screen:
1. **Choose:** From and To dates (default: first of this month to today), envelope checkboxes with "Select all" / "None", toggle "Include merchant and notes", **off** by default, helper "Off keeps your spending details private." Button "Preview".
2. **Preview:** the email exactly as it will be sent, in a framed panel with a loading state, and "Change".
3. **Send:** recipients field (comma or new line), shown as chips, invalid ones flagged; note "Until a sending domain is verified, reports only reach the account owner's address."; button "Send report" → confirm sheet "Send this report to 2 people?" listing addresses.
   - **Unverified account state:** the recipients field is locked to the user's own address, with the helper "Verify your email to send reports to other people. For now you can send them to yourself."
   - **Data changed state:** if any entry changed after the preview, Send is refused, the fresh preview is shown again, and above it: "Your data changed since the preview. Preview again before sending."
Result: "Accepted by email provider. It may take a few minutes to arrive. Check spam if it doesn't." or the reason it failed ("You've sent a lot of reports. Try again in a few minutes.", "This exact report was already sent to these people a few minutes ago."). **Never use the word "delivered".**
"Recent sends" list: date and time, range, recipient count, status chip "Accepted by email provider" or "Failed" with the reason.

### 12. Report email (separate artboard, 600 px wide)
Based on a paper habit-tracker grid: bordered cells, clear headings, calm. Title "PocketPlan report", subtitle "1–30 Nov 2026".
Main table, two header rows:
- Row 1: blank over the name column · **"Activity 1–30 Nov 2026"** spanning 5 columns · **"As of 30 Nov 2026"** spanning 2 columns.
- Row 2: Envelope · Opening · + Allocated · − Moved out · − Spent · + Refunds · Closing · Target.
Rows: one per envelope (colour swatch cell + name), then **Unallocated**, then **Total (all envelopes)** in bold with a heavier top rule. Zero shown as "—".
Optional second table when notes are included: Date · Envelope · Merchant / note · Amount.
Footer: "Sent from PocketPlan by you@example.com. Balances in RM. Activity covers 1–30 Nov 2026; Closing is the balance at the end of 30 Nov 2026."
**Email constraints** (Gmail mobile must render it): tables and inline styles only, no web fonts, no images, no background images, max width 600 px, horizontal scroll allowed on the table at phone width. Design it once in the **Retro** palette regardless of the app theme (cream `#faf7f2`, ink `#4a3b2f`, gold rules `#c9a96e`), unless you recommend otherwise.

## Sample data (use everywhere)

Total remaining RM 2,949.50 · Unallocated RM 700.00
| Envelope | Colour | Balance | Target |
|---|---|---|---|
| Food | #E07A5F | RM 581.50 | RM 600.00 |
| Transport | #4A90A4 | RM 318.00 | RM 300.00 |
| Bills | #3D405B | RM 1,200.00 | RM 1,200.00 |
| Fun | #8E7DBE | RM 150.00 | — |

Entries: 1 Nov "Salary" +RM 3,000.00 · 1 Nov allocations · 3 Nov "Nasi lemak" −RM 18.50 (Food) · 4 Nov "Jacket shop" −RM 150.00 (Fun), refunded RM 150.00 on 6 Nov · 5 Nov "Fun → Transport" RM 150.00 · 5 Nov "Grab" −RM 32.00 (Transport).

## Out of scope (do not design)

Bank connections, payments, receipts, charts beyond progress bars, budgets that reset monthly, shared households, scheduled emails, settings pages, onboarding carousels, notifications.

## What to hand back

1. The four theme directions (dashboard + quick add, light and dark) and your recommendation.
2. Every screen above in the chosen direction at phone width (390), with each listed state.
3. Every screen at tablet (834 portrait; Home and History also 1194 landscape) and desktop (1280 and 1440), using the layouts in "Responsive layout", with the main states.
4. The report email artboard.
5. A token sheet using the token names above (light and dark values), plus type, spacing, shadow and the 8 envelope colours.
6. The component list, each named by its shadcn counterpart from the table above, with its states (default, hover, pressed, focus, disabled, loading, error), and how each one changes across phone, tablet and desktop (Drawer vs Dialog vs side pane, bottom nav vs sidebar).
7. A motion spec: for each animation listed above, the trigger, duration, easing or spring values, and the reduced-motion fallback.
8. A short checklist showing each screen passes the quality bar above.
