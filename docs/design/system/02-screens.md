# Screens

Every screen, its states, and how it lays out at phone (390 × 844), tablet (834 × 1194 portrait; 1194 × 834 landscape for Dashboard and Activity) and desktop (1280 × 800, 1440 × 900). Phone is the starting frame for every screen. Rendered examples: DashboardScreen, ActivityScreen, EnvelopesScreen, InsightsScreen, QuickAddSheet, AllocateScreen, ProfileScreen, SignIn, HealthScore, Charts and ReportEmail cards. The reference for the restructure (2026-11-09) is a finance-app shot Lucas shared: Dashboard, Activity, a centre +, and insights; its Ask, receipt scan, voice, investments, goals, accounts, tags and split expense are not part of PocketPlan. Sample data throughout: Total remaining RM 2,949.50, Unallocated RM 700.00, Food RM 581.50 of RM 600.00, Transport RM 318.00 of RM 300.00, Bills RM 1,200.00 of RM 1,200.00, Fun RM 150.00 with no target.

## App shell

- Phone: fixed bottom bar on `card`, 56px plus safe area, five equal slots in this order: Dashboard, Activity, + (Quick add, the 56px round button raised above the bar), Envelopes, Insights. Toasts appear above the bar. The Dashboard header holds a Share report button (jumps to Envelopes › Reports) and the Profile avatar button.
- Tablet: collapsed icon sidebar (Dashboard, Activity, Envelopes, Insights) with labels on hover and focus, expandable, a Profile item at its bottom; topbar with the page title and "+ Add". Toasts bottom right.
- Desktop: full sidebar with labels and the user's email at the bottom as the link to Profile; topbar "+ Add"; shortcut N opens Quick add when no text field has focus.
- Back always returns where the person came from. Activity filters, the Envelopes segment, the Insights tab and period, and an open entry live in the URL and survive a refresh.

## 1 Sign up

Title "PocketPlan", one line "Track the money you have, one envelope at a time." Email, Password with show/hide, Confirm password, helper "At least 8 characters", button "Create account", link "Already have an account? Sign in". States: "Passwords don't match" under Confirm; "An account with this email already exists. Sign in instead." above the button; submitting (loading button). Layout: a centred `auth-card` at every size; desktop may add a quiet left panel with the one-line promise.

## 2 Sign in

Email, Password with show/hide, "Sign in", links "Forgot password?" and "New here? Create an account". States: "Email or password is incorrect"; "Too many attempts. Wait a minute and try again."; submitting. Same layout as Sign up.

## 3 Forgot and reset password

Forgot: email, "Send reset link", then the confirmation "If an account exists for that email, we sent a reset link." Reset: New password, Confirm, "Set new password". States: "Password updated" with a Sign in link; "This reset link has expired. Request a new one."

## 4 Dashboard

Phone, top to bottom: header (brand, Share report, Profile avatar); SummaryCard hero (Total remaining in `amount-xl`, Unallocated row with "Allocate →" when above zero); Cash flow card ("Net cash flow · November" = income minus spending for the period, a 12-point sparkline of total remaining, Week · Month · Year Tabs where Week is the last 7 days, Month the calendar month to date and Year the calendar year to date, In and Out tiles for the same period); Spending over the last 6 months as emphasis columns with the current month in `primary` and its value as the only label; Spent by envelope as a thin segmented bar over rows (swatch, name, share, amount); Health score (section 15); the last 3 entries with "See all in Activity". Total remaining stays the single hero figure (suggested default; the reference leads with cash flow). States: first run ("Start by recording the money you have" with "Add income" and "Create envelopes", no charts or score until the first entries); one month of data (charts show only the current month, "Not enough history yet" where a comparison would be); refunded spending nets out and says so in one line; long envelope name truncated, amount intact.
Tablet: summary and health side by side, cash flow beside the envelope split, chart full width, recent entries. Landscape 1194: the desktop arrangement.
Desktop: three tiles across (summary, cash flow, health), the chart beside the envelope split, recent entries full width. Content capped at `content-data`.

## 5 Quick add

Drawer on phone, Dialog elsewhere. Title "Quick add"; Tabs Expense (default) · Income · Transfer. Expense: money field auto-focused with the numeric keyboard, envelope chips (none preselected), Date defaulting to today, "Add details" revealing Merchant and Note, "Save expense". Income: amount, date, optional note, "Save income". Transfer: amount, From (Unallocated or an envelope, with balances), To, "Save transfer". States: Save disabled until valid; inline server error above Save ("Transport has RM 200.00, short by RM 120.00"); "Create an envelope first"; submitting. Desktop keyboard: Enter saves, Escape closes, arrows move between tabs when a tab has focus.

## 6 Allocate

Header "Allocate", "Unallocated RM 700.00". One row per envelope: swatch, name, balance, amount Input, "RM x to target" and "Fill to target" when below target. Sticky footer: "Left to allocate RM x" (turns `destructive` when negative) and Save. States: over-allocated (Save disabled), nothing entered, no envelopes.
Tablet and desktop: a two-column table (envelope, balance and target left; input and Fill to target right); the summary becomes a sticky side panel.

## 7 Envelopes tab

The Envelopes tab has two segments as Tabs: Envelopes and Reports (section 11). The segment lives in the URL. Insights (section 14) is its own tab in the bottom bar. The Envelopes segment is the manage screen below, with an Unallocated card and Allocate button above the list.

Title and "New envelope". Rows with swatch, name, balance, target bar, up/down buttons. "Show archived (n)" reveals greyed rows with Unarchive. Sheet "New envelope" / "Edit envelope": Name, colour picker (None plus 8 round radio swatches), Target (optional, RM) with helper "A goal for this envelope. It does not move any money." States: empty list; archived list open.
Tablet and desktop: a table (name, balance, target with progress, actions); drag handle for pointer reorder, up/down kept for keyboard; the form opens in a right-hand side Sheet.

## 8 Envelope detail

Back link, swatch and name (plus "Archived" badge), balance in `amount-xl`, target bar and "Target RM x", buttons Edit and Archive/Unarchive, "Recent entries" (Activity rows) with "See all". States: archive confirm ("It disappears from your dashboard and quick add. Its history stays. Only an empty envelope can be archived."); archive refused ("Move RM 12.50 out of Food first"); not found.
Tablet and desktop: balance, target and actions on the left; recent entries on the right.

## 9 Activity

Every expense, income, refund, transfer and allocation, viewed and corrected here. Phone: title with the entry count, a search Input (merchants, notes, amounts), filter chips in one horizontally scrolling row (All, Expenses, Income, Refunds, Transfers, Recurring), then day groups ("6 Nov 2026" with the day's net on the right) of TransactionRows, one Card per day. Row kinds are in the TransactionRow card. Tapping a row opens Entry detail (section 10); amounts are never edited in place. "Load more" after 50 rows; later pages "Showing older entries · Back to latest". States: nothing recorded; no matches; invalid filters note.
Recurring (new, suggested default, confirm with Lucas): an entry marked "Repeats monthly" from its detail gets a "Repeats" Badge and appears under the Recurring filter with its next date; PocketPlan reminds, it never records money by itself. Needs a recurrence field on entries.
Tablet and desktop: master–detail; filters in a bar (Type Tabs, Envelope Select, From, To, "Clear filters"); list two thirds with date, label, envelope and amount columns; the entry's detail, void and refund actions in a right pane.

## 10 Entry detail

Drawer on phone, right pane elsewhere. Title = kind. Definition list: Amount, Date, Envelope or From/To, Merchant, Note, "Refunded RM x of RM y", Voided date. Buttons: "Record refund" (expenses), "Void entry" (destructive) or "Restore entry". Void confirm: "This entry stops counting. It stays in your history and you can restore it." (+ "Its refunds are voided too."). Refund form: prefilled refundable amount, date, note, "You can refund up to RM x". States: server refusal inline ("Voiding this would leave Fun at −RM 150.00"); success toast.

## 11 Reports

Lives in the Envelopes tab as the Reports segment; the Share report button in the Dashboard header opens it. Three steps. Choose: From and To (first of this month to today), envelope Checkboxes with "Select all" / "None", Switch "Include merchant and notes" off by default with helper "Off keeps your spending details private.", button Preview. Preview: the exact email in a framed panel with a Skeleton while loading, and "Change". Send: recipients as chips with invalid ones flagged; note "Until a sending domain is verified, reports only reach the account owner's address."; "Send report" then confirm "Send this report to 2 people?" listing addresses. Send is disabled while a preview loads. States: unverified account (field locked to own address, helper "Verify your email to send reports to other people. For now you can send them to yourself."); data changed ("Your data changed since the preview. Preview again before sending."); result "Accepted by email provider. It may take a few minutes to arrive. Check spam if it doesn't." or the failure reason. Recent sends: date and time, range, recipient count, status Badge.
Desktop: builder left, live preview right, recipients under the builder, recent sends as a small table below.

## 12 Report email

A separate 600px artboard in the Retro palette; see the ReportEmail card for the artboard and its email constraints.

## 13 Profile

Reached from the Profile button (phone header), the Profile item (tablet sidebar) or the email row (desktop sidebar). Email with Sign out, then the Theme card: four Radio Group tiles (Modern, Retro, Pixel, Premium), each with a miniature in its own tokens, a name and one line; then Appearance as System · Light · Dark. Saving is immediate; the shell re-themes in place and a toast says "Theme saved." States: default (Modern, System); after choosing another direction; save failed ("Couldn't save your theme. Try again.", choice reverted). Phone: full page with Back, no bottom nav. Tablet and desktop: content capped at `content-reading`, Profile marked current in the sidebar. See the ProfileScreen card.

## 14 Insights

The last tab of the bottom bar, where past spending and income are read in detail; see the InsightsScreen card. A Share report button in its header opens Envelopes › Reports for the same period. Spending · Income · Cash flow Tabs and a period control (This month, Last month, 12 months; This month is month to date and says so). Spending: the period's total in `amount-xl` with the change against the previous period (arrow, percentage, `destructive` only when spending rose), a 12-month column chart with a labelled axis and dashed gridlines, "Envelope movement" rows (swatch, name, change, amount, thin bar in the envelope's colour sized to its share), then Priciest day and Small spends (entries under RM 20) tiles. Income: the same chart for income and the period's income entries. Cash flow: income minus spending per month as diverging columns on a zero baseline, `primary` above and `destructive` below, with a three-month In · Out · Net table. Tapping a column selects that month; tapping a movement row opens Activity filtered to that envelope and period. Everything is derived from entries on read. States: under two months of data ("Not enough history to compare yet", the chart shows what exists); no spending in the period; no envelopes.
Tablet: single column, chart first. Desktop: chart Tabs and the period control in one row; chart and tiles left, movement rows right.

## 15 Health score

A 0 to 100 score for how safe the month looks, from data PocketPlan already holds. Suggested default, to confirm with Lucas: four signals of 25 points each. Buffer: unallocated as a share of total remaining (25 at 20% or more, 0 at zero). Envelopes: every targeted envelope holds at least 25% of its target (0 if any is at zero). Pace: spending so far this month against the average of the last three months at the same day (25 at or under, 0 at 150% or more; no history gives 25). With no targeted envelope the Envelopes signal also gives 25. Habit: entries on 5 or more of the last 7 days (0 with none). Bands: 75 to 100 Strong, 50 to 74 Watch, under 50 At risk, always shown with an icon and the word. The card shows the score in `amount-xl`, the band, "How it's scored" (opens a Drawer listing the signals), a Meter (`primary`, `destructive` for At risk, `muted` track) and one line per signal; Watch and At risk add one sentence naming the envelope to fix. Recomputed on read, never stored.

## Empty and error states

Centred in the content area at every size, never stretched edge to edge: one sentence in `foreground`, one in `muted-foreground`, at most two buttons.
