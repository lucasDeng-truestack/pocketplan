PocketPlan is a mobile-first envelope-budgeting web app for one person. It tracks money in Malaysian ringgit; it never holds it. Everything here exists so one feeling survives every screen: *I know exactly where my money is, and recording a purchase takes three seconds.*

## Content fundamentals

- Write to one person as "you". Short sentences, plain words, no exclamation marks, no emoji anywhere in the UI.
- Amounts are always `RM 1,234.56`: a space after RM, thousands separators, two decimals, never truncated. Money leaving is `−RM 18.50` with a true minus (U+2212) and the `destructive` colour; money arriving is `+RM 3,000.00` in `foreground`; a transfer or allocation is unsigned in `muted-foreground`.
- Dates read "6 Nov 2026"; ranges "1–30 Nov 2026" with an en dash.
- Button labels name the result: "Save expense", "Record refund", "Void entry", "Send report". Confirms repeat the consequence in a sentence: "This entry stops counting. It stays in your history and you can restore it."
- Errors say what is true and what to do: "Transport has RM 200.00, short by RM 120.00". Never "Something went wrong".
- Never the word "delivered" for email. "Accepted by email provider" is the strongest claim the UI makes.
- Calm, not gamified: no confetti, streaks, alarms or red screens. Colour is meaning.

## Colour

- Chrome is neutral. Page on `background`, text `foreground`; cards, lists, sheets and the nav on `card` with a 1px `border`. Menus, selects and toasts on `popover`.
- `primary` is for one thing per screen: the main button, the + in the bottom bar, the selected tab. `secondary` for the second action. Hover and pressed states sit on `accent`.
- `muted-foreground` carries labels, captions and the RM prefix on `background` and `card`. In Modern light it is 4.4:1 on `muted`, so keep small text off `muted` surfaces there.
- `destructive` is for errors, the Void entry button and money-out amounts, always with a sign or a word as well, never colour alone.
- Envelope colours `envelope-1` to `envelope-8` are the only strong colours. They identify an envelope (swatch, chip, progress fill, email dot) and never carry any other meaning; a swatch always sits beside the envelope's name. `envelope-none` is the neutral grey for an envelope without a colour. Several slots fall under 3:1 on light `card` by design (they are decorative, not informational); their notes say which.
- The theme is a per-account setting chosen on the Profile page: one of the four directions (Modern, Retro, Pixel, Premium) plus an appearance of System, Light or Dark. It is saved on the profile and follows the person to every device. Apply it as `data-theme="<direction>-<light|dark>"` on the `html` element, rendered on the server from the profile so the first paint is already themed; with appearance System, resolve light or dark from `prefers-color-scheme` on the client and keep the direction fixed. New accounts start on Modern and System.
- Inside components, only semantic tokens; raw hex appears only where an envelope colour is applied as an inline style.

## Typography

- Set everything in `sans` (Geist). `heading` is the same face in the Modern direction; `mono` (Geist Mono) is available for amounts but Modern uses tabular Geist instead.
- Amounts use `amount-xl` (Total remaining, envelope balance on its detail page), `amount-lg` (secondary totals, the money field, Left to allocate) and `amount` (every row). All three use tabular figures and never wrap or truncate.
- `heading` for screen and sheet titles, `body` (16px) for everything a person reads or types, `small` (14px) for labels, helpers and badges, `caption` (12px) for day headings and bottom-nav labels. Nothing in the app is smaller than 12px; no form field is smaller than 16px.
- Line height is about 1.5 for text, tighter for large amounts.

## Spacing and layout

- 4px grid: `space-1` to `space-8`. Card padding and the phone side gutter are `space-4`; tablet and desktop gutters `space-8`.
- Every tappable control is at least `tap-target` (44px) tall and wide, with `space-2` between targets. The + button is `fab-size` (56px), the centre slot of the bottom bar, raised 20px above it, above the safe area.
- Reading content (forms, sheets, prose) caps at `content-reading` (640px); data views (Dashboard grid, Activity table) at `content-data` (1200px), centred. Auth cards cap at `auth-card` (420px). The report email is `email-width` (600px).
- Three breakpoints. Phone under 640px: bottom bar with the + in it, Drawers. Tablet 640 to 1023px: collapsed icon sidebar (`sidebar-collapsed`), "+ Add" in the topbar, Dialogs. Desktop 1024px and up: full sidebar (`sidebar-full`) with the user's email and Sign out, Dialogs, keyboard shortcut N for Quick add. The Screens section lists each screen's layout at each size.
- No horizontal page scroll at any width. The report email table is the one allowed scroller.

## Shape, borders and shadows

- `radius` is the one base (0.5rem in Modern); `radius-sm` badges, `radius-md` chips, `radius-lg` buttons, `radius-xl` inputs, `radius-2xl` cards and sheets, `radius-full` swatches, progress bars and the + button.
- Borders are 1px `border`; inputs use `input`. Shadows are quiet: `shadow-sm` on cards, `shadow-fab` on the + button and toasts, `shadow-sheet` on Drawers and Dialogs.
- Focus is a 2px solid `ring` with 1px offset on every control, in both themes.

## Components

Build every control as its shadcn/ui counterpart (Radix primitives, "Nova" style) so the design maps 1:1 to code: Button, Input + Label, Drawer (phone) / Dialog (tablet, desktop) / Sheet (side panes), Tabs, Toggle Group (envelope chips), Radio Group (theme picker), Select, Checkbox, Switch, Card, Badge, Progress (target bars and the health Meter), Chart (Recharts: sparkline and columns), Sonner (toasts), Skeleton. Navigation is Dashboard · Activity · + · Envelopes · Insights, with Profile behind the Dashboard avatar or the sidebar foot; Reports is a segment of the Envelopes tab. The Components section holds the full mapping, each component's states and how it changes across the three sizes. Live examples sit in the component cards.

## Iconography

Lucide only, at 16px inside buttons and 20px in navigation, stroke 2, `currentColor`. No emoji, no other icon set. Every icon-only button has an `aria-label` and, on pointer devices, a tooltip. Envelope icons in the Pixel direction are drawn as pixel art within the same 20px box.

## Motion

Framer Motion. Animate transform and opacity only; 150 to 250ms for small changes, up to 400ms for sheets; every animation has a `prefers-reduced-motion` fallback that is instant or a plain fade. The Motion section specifies each animation.

## Not in this system

Bank connections, payments, receipts, charts beyond progress bars, monthly resets, shared households, scheduled emails, onboarding carousels, notifications. The only settings page is Profile, and the only setting on it is the theme.
