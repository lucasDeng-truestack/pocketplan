# Motion

Framer Motion. Rules: animate only transform and opacity (never width or height); 150 to 250ms for small UI changes, up to 400ms for sheets; motion means something, no decorative loops; every animation has a `prefers-reduced-motion` fallback that is instant or a plain fade (use `useReducedMotion()`).

| Animation | Trigger | Spec | Reduced motion |
|---|---|---|---|
| Drawer opens | Tap + or a row | Sheet `y: 100% → 0` with spring `{ type: "spring", stiffness: 400, damping: 36 }` (settles in about 320ms); backdrop `opacity 0 → 1` over 200ms ease-out | Sheet and backdrop fade in over 150ms |
| Drawer closes | Save, Cancel, Escape, backdrop tap, swipe down | Reverse: `y: 0 → 100%` same spring, backdrop fades 150ms | Fade out 150ms |
| Dialog (tablet, desktop) | Same triggers | `opacity 0 → 1` and `scale 0.96 → 1` over 200ms ease-out; close reverses in 150ms | Fade only |
| Toast | After a successful save or send | Slides `y: 16 → 0` and fades in over 200ms ease-out above the bottom bar (bottom right on larger screens); auto-dismiss after 4s with a 150ms fade | Fade only |
| Tabs highlight | Tab change | Selected background is a `layoutId="tab"` element; shared layout transition 200ms, ease `[0.2, 0, 0, 1]` | Highlight jumps |
| Envelope reorder | Up/down button or drag drop | Rows are `layout` elements; position change over 200ms, ease-out | Rows jump |
| Dashboard amounts | After a save changes Total, Unallocated or a balance | Count-up from old to new value over 350ms ease-out, tabular figures so width stays stable; the sign and the RM prefix do not animate | Value changes instantly |
| Left to allocate | Total entered crosses zero | Colour transition `foreground ↔ destructive` over 200ms; the minus sign appears instantly | Instant |
| Button press | Pointer or touch down | `whileTap={{ scale: 0.97 }}`, 150ms; Pixel direction translates 2px and drops the stepped shadow instead | None |
| Chip select | Tap a chip | Border colour over 150ms | Instant |
| Skeleton | While data loads | Opacity pulse 0.6 ↔ 1 over 1.2s, the one allowed loop, stops when content arrives | Static at 0.8 |
| Health score | First paint of the Dashboard | Number counts up from 0 over 400ms ease-out while the Meter fills to the score; the band word and icon appear at the end | Final state at once |
| Spending columns | Chart enters the viewport | Columns grow from the baseline over 300ms, staggered 30ms, the current month last | Drawn complete |
| Sparkline | Chart enters the viewport | Path draws left to right over 400ms (`pathLength` 0 → 1) | Drawn complete |
| Envelopes hub segment | Tapping Envelopes · Insights · Reports | Same indicator slide as other Tabs; panels cross-fade over 150ms, no horizontal swipe | Instant switch |
| + in the bottom bar | Pointer or touch down | `whileTap={{ scale: 0.94 }}`; Quick add opens as the Drawer spring | Scale skipped |
