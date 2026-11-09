# ReportEmail

The report email at 600px, built the only way Gmail mobile renders reliably: tables and inline styles, no web fonts, no images, no background images. It uses the Retro palette regardless of the app theme: cream `#faf7f2`, ink `#4a3b2f`, gold rules `#c9a96e`, muted ink `#75624f` (4.9:1 on cream).

- Title "PocketPlan report", subtitle with the range. The main table has two header rows: a blank cell over the name column, "Activity 1–30 Nov 2026" spanning five columns, "As of 30 Nov 2026" spanning two; then Envelope · Opening · + Allocated · − Moved out · − Spent · + Refunds · Closing · Target.
- One row per envelope with a colour dot and name, then Unallocated, then Total (all envelopes) in bold with a heavier top rule. Zero is shown as "—". Amounts right-aligned, never wrapped.
- Optional second table when notes are included: Date · Envelope · Merchant / note · Amount.
- Footer: "Sent from PocketPlan by you@example.com. Balances in RM. Activity covers 1–30 Nov 2026; Closing is the balance at the end of 30 Nov 2026."
- The table is the one place horizontal scroll is allowed, at phone width. Georgia is the serif fallback that ships on every mail client.