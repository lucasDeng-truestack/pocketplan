# EnvelopeChip

shadcn Toggle Group (single choice) rendered as wrapping chips: swatch, envelope name, and the current balance in `small` `muted-foreground`.

- None preselected when Quick add opens. Selecting one is the second of the three taps that record an expense.
- Selected: `primary` border, drawn as a 1px border plus a 1px inset ring so the chip does not change size. Colour alone never marks selection.
- Minimum 44px tall, 8px gaps. On phone the chips wrap in a flow grid; on tablet and desktop they may sit in a wider 3 or 4 column grid inside the Dialog.
- Archived envelopes do not appear. With no envelopes the group is replaced by the sentence "Create an envelope first."
- Keyboard: arrow keys move between chips, Space selects, as Radix Toggle Group provides.