# PocketPlan design system (snapshot, 2026-11-09, artifact version 10)

Live artifact with rendered previews of every card: https://claude.ai/artifact/9WZVHyQUWo3Y4UFkFYmuhS
(private; Claude Code can read it with the Artifact tool, action "read", when the owner is signed in).

Read in this order when building:

1. `06-build-handoff.md` — what Lucas confirmed, the suggested defaults to confirm, the work in order, what is out of scope.
2. `02-screens.md` — every screen, its states and layout at phone, tablet and desktop.
3. `03-components.md` — shadcn mapping, routes, new read models.
4. `tokens.json` / `tokens.css` — the eight themes under the shadcn variable names the code reads.
5. `components/*.md` — per-card specs (DashboardScreen, ActivityScreen, EnvelopesScreen, InsightsScreen, HealthScore, Charts, Navigation, ProfileScreen, SignIn, SignInTablet, SignInDesktop, …).
6. `04-motion.md`, `05-quality-checklist.md`, `01-directions.md`, `README.md` (brand book).

The `preview.html` files are not copied; the artifact renders them.
