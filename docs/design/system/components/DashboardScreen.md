# DashboardScreen

The Dashboard (formerly Home): the overview of the money you have, where it went and how healthy the month looks. Phone shows the page at the top and scrolled; desktop shows everything in one 1280 frame.

- Order on phone: header (brand, Share report, Profile avatar), the SummaryCard hero (Total remaining in `amount-xl`, Unallocated with "Allocate →"), the Cash flow card, Spending over the last 6 months, Spent by envelope, Health score, then the last entries with "See all in Activity". Total remaining stays the one hero figure; the other numbers are stat tiles (suggested default: Lucas may prefer net cash flow first, as in the reference).
- Cash flow card: "Net cash flow · November" = income minus spending for the period, a 12-point sparkline of total remaining in `primary`, Week · Month · Year Tabs, and In / Out tiles. Month to date is stated, never implied.
- Spending chart: one series, columns in `muted-foreground` at 35% with the current month in `primary` and its value as the only direct label. No second axis, no legend for one series. Earlier months here are illustrative sample data.
- Spent by envelope: a thin segmented bar (2px gaps) above rows with swatch, name, share and amount. Colour is the envelope's own; the name and amount beside it carry identity, never colour alone. Refunded spending nets out and is said so in one line. The card links to the Insights tab for the full breakdown.
- Health score: see the HealthScore card. Tapping "How it's scored" opens a Drawer with the four signals.
- First run: the start card replaces everything below the header; charts and the score appear after the first entries.
- Desktop 1280: three tiles across (summary, cash flow, health), then the chart beside the envelope split, then recent entries. Tablet: two columns. Content caps at `content-data` (1200px).