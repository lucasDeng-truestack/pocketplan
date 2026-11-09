# SignIn

Sign in, sign up and the reset-link screen on a phone. The top shows the logo and a small fan of the sample envelopes, then the form sits straight on `background` with no card around it.

- Sign in: segmented switch, "Welcome back", Email, Password with "Forgot password?" on its label row, "Sign in". Errors: "Email or password is incorrect", "Too many attempts. Wait a minute and try again."
- Sign up: "Start your plan", Email, Password with the live 8-character check, Confirm password, "Create account". Errors: "Passwords don't match", "An account with this email already exists. Sign in instead." Submitting shows the loading Button.
- Forgot password: Email and "Send reset link", then "Check your email" with "Back to sign in". Reset: New password, Confirm, "Set new password"; states "Password updated" and "This reset link has expired. Request a new one."
- Footer line on every form: "PocketPlan tracks money you already have. It never connects to your bank."
- Tablet and desktop layouts: SignInTablet and SignInDesktop.

- Theme: these pages show before anyone is signed in, so they use Modern and follow the device's light or dark setting. The profile theme applies after sign-in.
- The Sign in / Create account switch is a pair of links styled as the segmented control (`SegmentedLinks`), with `aria-current="page"` on the current one. Each page keeps its own route.
- "Forgot password?" sits on the Password label row. Show password is an icon button inside the field with `aria-label` and `aria-pressed`.
- Sign up shows the 8-character rule as a live check that ticks once met. It is a hint, not an error; the error texts stay as they are in code.
- The envelope fan, the total tile and the trust points are decorative sample data and are `aria-hidden`. Never show real balances before sign-in.
- No bottom nav, no sidebar. Envelope colours appear only on the flaps; every name and amount is in text tokens.
- Motion: the fan cards ease in from a stacked pile, 40ms apart, 240ms each, and do not move under `prefers-reduced-motion`.