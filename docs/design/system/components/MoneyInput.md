# MoneyInput

shadcn Input + Label, and the money field: an Input with an "RM" prefix drawn inside the box.

- The money field is the hero of Quick add: 64px tall, the typed amount in `amount-lg` weight at 30px with tabular figures, the prefix in `muted-foreground`. `inputmode="decimal"` so phones open the numeric keyboard; it is auto-focused when the sheet opens.
- Every field has a visible label above it. Placeholders never replace labels.
- Errors sit under the field they belong to in `destructive` text at 14px, and the border turns `destructive`; helper text in `muted-foreground` explains a rule where one exists ("At least 8 characters").
- Focus: 2px `ring`, 1px offset, on the whole money box (focus-within).
- The show/hide password toggle is an icon Button inside the field with the label "Show password" / "Hide password".
- Same at every breakpoint; fields cap at `content-reading` width.