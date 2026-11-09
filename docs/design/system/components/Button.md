# Button

shadcn Button in the five variants the app uses: `default` (primary, one per screen), `secondary`, `outline`, `ghost` and `destructive`, plus the icon-only size.

- Minimum height 44px on touch screens (`tap-target`); the compact `sm` size is for header actions like Sign out.
- Primary fills `primary` with `primary-foreground`; destructive is a 12% `destructive` tint with `destructive` text, never a solid red block.
- Pressed state scales to 0.97 over 150ms (Framer Motion `whileTap`); Pixel direction translates 2px and drops its stepped shadow instead.
- Focus: 2px `ring` with 1px offset, on every variant.
- Loading replaces the label with a spinner and keeps the width; the button stays disabled while pending.
- Icon-only buttons carry `aria-label` and a tooltip on pointer devices. Icons are Lucide at 16 or 20px.
- Same component at every breakpoint; on desktop a primary button in a Dialog footer is right-aligned instead of full width.