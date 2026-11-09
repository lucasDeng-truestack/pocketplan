# SignInTablet

Tablet portrait, 834 × 1112. A tinted band at the top holds the logo, the line "Every ringgit has a job." and the envelope fan. The form sits in a 480px Card that overlaps the band by 72px. The three trust points sit under the Card, one line each.

- Left frame: sign in, empty. Right frame: sign up while submitting, with the 8-character check met.
- Landscape tablets (1024 and up) use the SignInDesktop split layout.
- Trust points: "Tracks money, never holds it. No bank link, no payments.", "Private by default. Reports go only when you press Send.", "Exact to the sen. No rounding, ever."

- Theme: these pages show before anyone is signed in, so they use Modern and follow the device's light or dark setting. The profile theme applies after sign-in.
- The Sign in / Create account switch is a pair of links styled as the segmented control (`SegmentedLinks`), with `aria-current="page"` on the current one. Each page keeps its own route.
- "Forgot password?" sits on the Password label row. Show password is an icon button inside the field with `aria-label` and `aria-pressed`.
- Sign up shows the 8-character rule as a live check that ticks once met. It is a hint, not an error; the error texts stay as they are in code.
- The envelope fan, the total tile and the trust points are decorative sample data and are `aria-hidden`. Never show real balances before sign-in.
- No bottom nav, no sidebar. Envelope colours appear only on the flaps; every name and amount is in text tokens.
- Motion: the fan cards ease in from a stacked pile, 40ms apart, 240ms each, and do not move under `prefers-reduced-motion`.