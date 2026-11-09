# ProfileScreen

The Profile page: the person's email with Sign out, then the Theme picker. Reached from the Profile icon button in the phone header, the Profile item at the bottom of the tablet sidebar, and the email row at the bottom of the desktop sidebar.

- Theme is a per-account setting, saved on the profile and applied on every device the person signs in on. Four radio tiles (Radix Radio Group), one per direction, each with a four-swatch miniature drawn in that direction's own tokens, its name and one line of description. The selected tile has a `primary` border and the radio is checked; colour alone never marks the choice.
- Appearance: System (default), Light, Dark as a three-way Tabs-styled radio group with the helper "System follows your device's light or dark setting."
- Saving is immediate on change (no Save button): the page re-themes in place and a toast says "Theme saved." A failed save reverts the choice and the toast says "Couldn't save your theme. Try again."
- Helper copy under the title: "Changes how PocketPlan looks on all your devices. Your money and envelopes stay the same."
- The second phone shows the page after choosing Retro and Light: the whole shell, including this page, switches at once.
- Phone: a full page with a Back button, no bottom nav highlight (Profile is not one of the four destinations). Tablet and desktop: the same content capped at `content-reading` under the topbar, with Profile marked current in the sidebar.
- No other settings live here in v1.