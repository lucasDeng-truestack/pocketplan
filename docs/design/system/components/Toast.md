# Toast

Sonner toasts: one line of confirmation, optionally one action link.

- Phone: slides up and fades in above the + button (200ms, ease-out), auto-dismisses after 4 seconds; tablet and desktop: bottom-right corner.
- Surface `popover`, text `popover-foreground`, `shadow-fab`. An error toast keeps the same shape with `destructive` border and text.
- The action link is bold `foreground` text, right-aligned ("Income added. · Allocate").
- Reduced motion: a plain fade.