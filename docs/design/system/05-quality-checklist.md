# Quality checklist

The quality bar from the brief, in its priority order, with how each screen meets it. Where a rule is met by a shared component it is listed once.

## 1 Accessibility
- Text contrast: `foreground` on `background` and `card` is at least 9:1 in every theme (Retro light is the lowest at about 10:1); `muted-foreground` is 4.5:1 or better on `background` and `card` in all eight themes (Modern light on `muted` is 4.4:1 and is kept off small text). Large amounts need 3:1 and exceed it everywhere.
- Focus rings: 2px `ring`, visible on every control in both themes; Modern light keeps the code's `#a8a29e` and flags it.
- Never colour alone: money out always has a minus sign; voided entries have a Badge and a strike-through; selected chips have a thicker border; envelope swatches sit beside names; the status badge has words.

## 2 Touch
- Every target at least 44 × 44px with 8px between: buttons, chips, rows, nav items, the close button, colour radios, checkboxes rows.
- Visible pressed (scale 0.97) and loading (spinner) states on every button.

## 3 Layout
- Mobile-first at 390; no horizontal page scroll at any width; the email table is the only scroller.
- Prose under 75 characters: forms and text capped at `content-reading`.
- Safe areas: bottom nav pads by `env(safe-area-inset-bottom)`; the + button sits above both.

## 4 Style consistency
- One direction everywhere; semantic tokens only; envelope colours are the single raw-hex exception, applied inline from user data.

## 5 Typography
- Body 16px, nothing under 12px (`caption` is the floor), line height about 1.5, tabular figures on every amount, amounts never truncated.

## 6 Forms
- Visible labels on every field; errors next to the field they belong to; helper text where a rule exists ("At least 8 characters", "Off keeps your spending details private.", "A goal for this envelope. It does not move any money.").

## 7 Navigation
- Four destinations plus the + at every size: Dashboard, Activity, +, Envelopes, Insights in the bottom bar on phone, sidebar on tablet and desktop, Profile from the avatar or the sidebar foot. Back goes where the person came from. Activity filters, the Envelopes segment and an open entry live in the URL.

## 8 Pointer and keyboard
- Hover states on `accent`; every action reachable by keyboard; logical tab order (amount, chips, date, details, save); Escape closes any Drawer or Dialog; Enter saves in Quick add; N opens Quick add on desktop; arrow keys move between tabs and chips.

## 9 Charts

- One axis per chart, one hue per job: `primary` for the current period or the single series, `muted-foreground` at 35% for context periods. No dual axes, no pies or donuts.
- Envelope colours are the user's own and are not a validated chart palette (the dataviz validator fails them for CVD separation), so every envelope-coloured mark carries its name and amount beside it, segments have 2px gaps, and a table view exists for each chart.
- Text in charts uses text tokens, never the series colour. The health band always has an icon and a word.
- Charts and the score render on the server from the same money helpers as the lists; integer sen in, formatted RM out.

## Per screen
| Screen | Notes beyond the shared rules |
|---|---|
| Sign up, Sign in, Forgot, Reset | Password toggle labelled; rate-limit message in words; card centred, never edge to edge |
| Quick add | Amount auto-focused, numeric keyboard; Save disabled until valid; server error as a live-region alert above Save |
| Allocate | Over-allocation shown by sign, colour and a disabled Save; sticky footer clears the safe area |
| Envelopes | Up/down buttons remain for keyboard; archived rows keep 4.5:1 text |
| Envelope detail | Archive refusal names the amount to move; confirm states the consequence |
| Entry detail | Void is `destructive` tint with a word, confirm before acting |
| Profile | Theme tiles are radios with names, not colour alone; immediate save confirmed by a toast; every direction passes the same contrast checks |
| Report email | Tables and inline styles only; muted ink `#75624f` 4.9:1 on cream; horizontal scroll allowed at phone width |
| Dashboard | Hero stays Total remaining; charts and score appear only after the first entries; month to date is stated |
| Activity | Search, chips and day totals; corrections through refund, void, restore only |
| Envelopes hub | Segment in the URL; Reports send disabled until the preview is ready |
| Health score | Four signals listed; At risk names one envelope to fix; recomputed on read |
| Insights | Period and tab in the URL; "Not enough history" under two months; deltas carry an arrow and a word, red only when bad for the person; every chart has its rows beneath it |
