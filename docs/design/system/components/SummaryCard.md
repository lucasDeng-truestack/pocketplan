# SummaryCard

shadcn Card holding Total remaining (the largest number on the Dashboard, `amount-xl`) and the Unallocated row.

- Total remaining is `foreground` on `card`, 36px, tabular figures. It ticks to its new value after a save (count-up under 400ms; reduced motion sets it instantly).
- The Unallocated row is a 44px link to Allocate whenever the amount is above zero ("Allocate →"); at zero it is plain text with no link.
- First run (no envelopes, no money) replaces the summary with the "Start by recording the money you have" card and two buttons. "Envelopes but none funded" shows "You have RM 700.00 to put into envelopes." with an Allocate button.
- Tablet and desktop: the summary becomes two cards across the top (Total remaining; Unallocated with the Allocate button inside).