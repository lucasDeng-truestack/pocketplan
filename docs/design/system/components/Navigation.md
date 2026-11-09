# Navigation

Four destinations plus the + at every size: Dashboard, Activity, + (Quick add), Envelopes, Insights. Profile is reached from the avatar button in the Dashboard header (phone) or the bottom of the sidebar (tablet, desktop); Reports live inside Envelopes. Lucide icons: house, list, plus, wallet, bar-chart-3, user-round.

- Phone (under 640px): a fixed bottom bar on `card` with a `border` top line, 56px plus the safe-area inset, five equal columns in this order: Dashboard, Activity, +, Envelopes, Insights. The + is the 56px round `primary` button in the centre, raised 20px above the bar; it opens Quick add. The active tab is `foreground` and semibold; inactive tabs `muted-foreground`. Labels at 12px (`caption`) are always visible; at 390px each column is 78px, enough for "Dashboard" and "Envelopes" at 12px without truncation.
- Tablet (640 to 1023px): a collapsed 72px icon sidebar (Dashboard, Activity, Envelopes, Insights) with a Profile item at the bottom; labels appear as tooltips on hover and focus; a toggle expands it.
- Desktop (1024px and up): a 240px sidebar with labels, the brand at the top, and the user's email at the bottom as the link to Profile (where Sign out and the theme picker live). Active item sits on `accent`.
- The topbar on tablet and desktop holds the page title and the "+ Add" button that opens the Quick add Dialog; keyboard shortcut N when no text field has focus.
- Every item is a real link, 44px tall, with `aria-current="page"` on the active one. The + is a button, not a link.