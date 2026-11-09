# TransactionRow

The Activity row: swatch, label with an optional second line, and a signed amount.

- Expense: merchant (or the envelope name when there is no merchant) and `−RM 18.50` in `destructive`. The minus sign is a true minus (U+2212) and always present: colour never carries the sign alone.
- Income: note or "Income", `+RM 3,000.00` in `foreground`.
- Refund: "Refund · Fun", `+RM 150.00` in `foreground`.
- Transfer and allocation: "Fun → Transport" or "Allocation → Food", amount unsigned in `muted-foreground` because it moves money without changing the total.
- Voided: row at 55% opacity, amount struck through, "Voided" Badge. An expense with refunds shows "Refunded RM 50.00" under its label in `small`.
- Day headings ("6 Nov 2026") are `caption` in `muted-foreground`. "Load more" sits at the bottom; later pages add "Showing older entries · Back to latest".
- Tapping a row opens Entry detail: a Drawer on phone, a right-hand pane on tablet and desktop. On desktop the list gains columns: date, label, envelope, amount, status.