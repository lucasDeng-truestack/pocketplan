# AllocateScreen

Allocate at phone width: one row per envelope with its balance, an amount Input with the RM prefix, a "RM x to target" hint and a "Fill to target" button when below target. A sticky footer shows "Left to allocate" and Save.

- "Left to allocate" is `amount-lg`; it turns `destructive` and shows a minus sign when the total entered exceeds Unallocated, and Save is disabled. The colour change is a 200ms colour transition; the sign change is instant.
- States: over-allocated (shown), nothing entered (Save disabled), no envelopes ("Create an envelope first.").
- Tablet and desktop: a two-column table (envelope with balance and target on the left; amount input and Fill to target on the right); the summary becomes a sticky side panel instead of a footer.