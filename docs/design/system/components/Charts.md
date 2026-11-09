# Charts

The four chart forms PocketPlan uses, each in plain SVG here and as a shadcn Chart (Recharts) in code. Charts obey the rules in the dataviz method: one axis, one hue per job, thin marks, recessive grid, text in text tokens.

- Stat tile: label, value, delta vs a named period, optional 12-point sparkline in `primary` with the current point ringed in `card`.
- Emphasis columns: one series, past periods `muted-foreground` at 35%, the current period `primary` with the only direct label. Column tops 4px rounded (0 in Pixel). A tooltip per column on hover.
- Segmented bar: 8px, 2px `card` gaps, segments in the envelopes' own colours, always with the named rows beneath it. Never a donut or a pie.
- Meter: a single ratio against a limit; fill `primary`, track `muted`, `destructive` fill for At risk.
- Envelope colours are user-chosen, so they are not a validated chart palette: every envelope-coloured mark has its name and amount beside it, and a table view exists for every chart.