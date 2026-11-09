# SignInDesktop

Desktop, 1280 × 800 and up. A split screen: the left half is the tinted brand panel, the right half centres a 400px form with no card.

- Brand panel: logo, the headline "Every ringgit has a job." at 44px, the line "Divide the money you have into envelopes and always know what's left.", the envelope fan over a Total remaining tile (RM 2,949.50, RM 700.00 unallocated, segmented bar), and the trust points along the bottom.
- Left frame: sign in after a wrong password. Right frame: sign up, empty.
- Under 1024px wide the brand panel collapses into the SignInTablet band.

- Theme: these pages show before anyone is signed in, so they use Modern and follow the device's light or dark setting. The profile theme applies after sign-in.
- The Sign in / Create account switch is a pair of links styled as the segmented control (`SegmentedLinks`), with `aria-current="page"` on the current one. Each page keeps its own route.
- "Forgot password?" sits on the Password label row. Show password is an icon button inside the field with `aria-label` and `aria-pressed`.
- Sign up shows the 8-character rule as a live check that ticks once met. It is a hint, not an error; the error texts stay as they are in code.
- The envelope fan, the total tile and the trust points are decorative sample data and are `aria-hidden`. Never show real balances before sign-in.
- No bottom nav, no sidebar. Envelope colours appear only on the flaps; every name and amount is in text tokens.
- Motion: the fan cards ease in from a stacked pile, 40ms apart, 240ms each, and do not move under `prefers-reduced-motion`.