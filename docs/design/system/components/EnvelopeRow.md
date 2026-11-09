# EnvelopeRow

The envelope list row on the Envelopes tab: swatch, name, balance, and a thin Progress bar under rows that have a target.

- The name truncates with an ellipsis; the amount never does. The balance is `amount` style, tabular figures.
- Progress: 8px tall, `border` track, filled with the envelope's colour; at or over target the bar is full. Progress carries no meaning beyond the target hint, so a low-contrast envelope colour is acceptable here (see the envelope token notes).
- An envelope at zero shows RM 0.00 in `foreground`, not grey, so it reads as a real balance.
- On Envelopes (manage) each row gains up and down reorder buttons (44px, labelled "Move Food up"). On pointer devices a drag handle (Lucide grip-vertical) replaces them visually; the buttons stay for keyboard users. Reordering animates rows to their new position (layout animation, 200ms).
- Archived rows sit at 60% opacity with an "Archived" Badge and an Unarchive button, revealed by "Show archived (n)".
- Tablet and desktop: the Envelopes tab renders them as a table (name, balance, target with progress, actions).