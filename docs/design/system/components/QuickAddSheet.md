# QuickAddSheet

The Quick add sheet: shadcn Drawer on phone, Dialog on tablet and desktop. Title "Quick add", Tabs for Expense (default), Income and Transfer, the money field auto-focused, envelope chips, a date defaulting to today, "Add details" revealing Merchant and Note, then the Save button.

- Recording an expense is tap +, type the amount, tap an envelope, tap Save. Nothing is added in front of those steps.
- Save is disabled until the amount is valid and an envelope is chosen. A server refusal appears inline above Save as an alert, for example "Transport has RM 318.00, short by RM 2.00". With no envelopes the chips are replaced by "Create an envelope first."
- Income: amount, date, optional note, "Save income". Transfer: amount, From (Unallocated or an envelope, with balances) and To as Selects, "Save transfer".
- Phone: slides up from the bottom with a spring (stiffness 400, damping 36, about 320ms), backdrop fades over 200ms; closing reverses. The sheet respects the bottom safe area.
- Tablet and desktop: a centred Dialog capped at `content-reading` width; chips may sit in a wider grid. Enter saves, Escape closes, arrow keys move between tabs when a tab has focus. Opened by "+ Add" in the topbar or the N shortcut.
- Reduced motion: the sheet and backdrop fade in over 150ms.