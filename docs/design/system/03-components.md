# Components

Each control in the design is drawn as its shadcn/ui counterpart so implementation is a mapping, not a reinterpretation. States for every control: default, hover (pointer only, on `accent` or a 8% darkening), pressed (scale 0.97), focus (2px `ring`, 1px offset), disabled (50% opacity, no pointer events), loading (spinner replaces the label, width kept), error (`destructive` border and message under the field). Live examples are in the component cards.

| In the design | shadcn component | Phone (under 640) | Tablet (640–1023) | Desktop (1024+) |
|---|---|---|---|---|
| Primary, secondary, ghost, outline, danger buttons | Button `default` `secondary` `ghost` `outline` `destructive` | Full width in sheets, 44px tall | Same | Right-aligned in Dialog footers |
| + (Quick add) | Button, 56px round | Centre slot of the five in the bottom bar, raised 20px | Replaced by "+ Add" in the topbar | "+ Add" in the topbar, shortcut N |
| Text, date, money fields | Input + Label; money = Input with an "RM" prefix inside the box | 48px tall, 64px for money | Same | Same, capped at `content-reading` |
| Quick add, entry detail, envelope form, confirms | Drawer | Bottom sheet, spring, backdrop | Dialog, centred | Dialog; entry detail becomes a right pane; envelope form a side Sheet |
| Expense · Income · Transfer; Activity Type filter | Tabs | Full-width segmented | Same | Same, arrow keys between tabs |
| Envelope chips | Toggle Group (single) | Wrapping flow grid | 3-column grid in the Dialog | 4-column grid |
| Theme picker on Profile | Radio Group, tiles with a miniature | Full-width tiles, 56px | Same, capped at `content-reading` | Same |
| Envelopes · Reports hub; Week · Month · Year; Spending · Income · Cash flow; This month · Last month · 12 months | Tabs | Full-width segmented | Same | Same |
| Activity search | Input with a leading search icon | Full width, 48px | Same | In the filter bar |
| Activity filter chips | Toggle Group (single), horizontal scroll | One scrolling row | Wraps | Replaced by Type Tabs |
| Sparkline, spending columns | Chart (Recharts) with the system's chart config; one series, `primary` plus `muted-foreground` at 35% | 120px sparkline, 140px columns | Same | 150px columns |
| Spent by envelope bar | custom 8px segmented bar, 2px gaps, envelope colours | Above the rows | Same | Same |
| Health score meter | Progress, fill `primary` or `destructive` | 8px | Same | Same |
| Stat tiles (In, Out, Priciest day, Small spends) | Card, compact padding | 2 per row | 2 to 4 per row | 4 per row |
| Envelope pickers (Transfer From/To, Activity filter) | Select | Native-feeling sheet | Popover | Popover |
| Report envelope list; Include notes | Checkbox; Switch | 44px rows | Same | Same |
| Summary, list containers, panes | Card | Full width, 16px padding | Grid of cards | Grid plus side panels |
| Voided, Archived, send status | Badge | 22px, 12px text | Same | Same |
| Target progress | Progress | 8px bar under the row | Inside the envelope card | Inside the card or table cell |
| Toasts | Sonner | Above the bottom bar | Bottom right | Bottom right |
| Loading | Skeleton | Rows and amounts as `muted` blocks | Same | Same |
| Bottom nav / sidebar | custom nav of links | Bottom tab bar | Collapsed 72px icon sidebar | 240px labelled sidebar |

Notes for the hand-off:

- The repository today has a house Sheet, Toast and Button with Tailwind classes, and shadcn's Button in `components/shadcn`. Drawer, Dialog, Tabs, Toggle Group, Select, Checkbox, Switch, Badge, Progress, Sonner and Skeleton are the target mapping; add them through the shadcn CLI with the existing `components.json` (style `radix-nova`, Lucide icons).
- The theme is a profile setting applied as `data-theme` on `html` (direction plus resolved light or dark), so the theme ids here are the ones the app will use. Appearance System resolves from `prefers-color-scheme` on the client. The profile needs a `theme` (direction) and `appearance` field, a server action to save them, and the attribute rendered in the root layout.
- Navigation (2026-11-09): routes become `/dashboard`, `/activity`, `/envelopes?tab=envelopes|reports`, `/insights?tab=spending|income|cashflow&period=…` and `/profile`; `/history` and `/reports` redirect. The bottom bar holds the Quick add trigger in its centre slot.
- New server reads for the Dashboard and Insights: monthly spending and income totals per envelope for the last 12 months, total remaining over the last 12 weeks, the four health signals. All are derived from entries on read; nothing new is stored except the optional recurrence on an entry (confirm with Lucas first).
- Envelope colour is the one inline style allowed inside a component (`style={{ backgroundColor: colour }}`), because it is user data.
