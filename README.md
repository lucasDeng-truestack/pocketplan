# PocketPlan

PocketPlan is a mobile-first envelope budgeting app: you record the money you have, split it into envelopes, and log spending against them. It can email a clean report of any period to you or anyone you choose; it never connects to a bank or moves real money.

## Stack

- **Next.js 16** (App Router): pages, server actions and API routes in one app.
- **Postgres** with **Prisma 7** (`@prisma/adapter-pg`): Postgres 17 in Docker locally, Neon in production.
- **Better Auth**: sign-up and sign-in with email and password, plus password reset by email.
- **Resend**: sends password-reset emails and reports.
- **Tailwind 4**: styling, no component library.
- **Vitest**: tests against a separate test database.

## Run locally

You need Node 24 and Docker. Locally the app uses Postgres 17 in Docker; Neon is only for production.

```bash
npm install
npm run db:up
cp .env.example .env.local
```

`npm run db:up` starts the `pocketplan-postgres` container (Postgres 17, host port 5436, data kept in the `pocketplan-pgdata` volume). On its first start it also creates the `pocketplan_test` database.

Fill in `.env.local`:

| Key | Value |
|---|---|
| `DATABASE_URL` | `postgresql://pocketplan:pocketplan@localhost:5436/pocketplan` |
| `TEST_DATABASE_URL` | `postgresql://pocketplan:pocketplan@localhost:5436/pocketplan_test` |
| `BETTER_AUTH_SECRET` | Run `openssl rand -base64 32` and paste the output. |
| `BETTER_AUTH_URL` | `http://localhost:4100` |
| `RESEND_API_KEY` | Leave empty locally. Password-reset links are then printed in the terminal. |
| `RESEND_FROM` | The From address, e.g. `PocketPlan <onboarding@resend.dev>`. See [Resend](#resend). |

Create the tables in both databases, then start the app:

```bash
npm run db:migrate
DATABASE_URL="postgresql://pocketplan:pocketplan@localhost:5436/pocketplan_test" npx prisma migrate deploy
npm run dev
```

Open http://localhost:4100, choose **Create an account**, and sign up with any email and a password of at least 8 characters. You land on the dashboard.

Forgot a password locally? Use **Forgot password?** on the sign-in page. With `RESEND_API_KEY` empty no email is sent; the terminal prints a block marked `DEV EMAIL (not sent)` with the reset link. Open it in the same browser. The link expires in 1 hour and works once.

## Tests

The tests write to a real database. `TEST_DATABASE_URL` points at `pocketplan_test` in the same Docker container, and the tests refuse to run if it equals `DATABASE_URL`. Migrate it once (the second command above) and after every new migration, then:

```bash
npm test
```

`npm run lint` runs ESLint and the TypeScript checker. Both must pass before a change is handed off.

## Deploy to Vercel

1. Push the repo to GitHub and import it in Vercel. The defaults for Next.js work.
2. In Project → Settings → Environment Variables, set:
   - `DATABASE_URL`: the Neon **pooled** connection string (Neon console → your project → Connect).
   - `BETTER_AUTH_SECRET`: a fresh value from `openssl rand -base64 32`. The app refuses to start in production if it is missing or shorter than 32 characters.
   - `BETTER_AUTH_URL`: your production URL, e.g. `https://pocketplan.vercel.app`. Password-reset links point here.
   - `RESEND_API_KEY` and `RESEND_FROM`: see below. In production there is no console fallback; without a key, password-reset emails fail (sign-up and sign-in still work).
3. Apply migrations to the production database. Either run this once from your machine before each deploy that adds a migration:

   ```bash
   DATABASE_URL="<production pooled URL>" npx prisma migrate deploy
   ```

   or, as an option, make it part of every build by changing the build script to `"build": "prisma migrate deploy && next build"`. The repo does not do this by default.
4. Deploy, open the production URL and sign in.

## Auth

- Email and password through Better Auth. Passwords are 8 to 128 characters and stored hashed in `Account.password`.
- Signing up sends a confirmation link (valid 24 hours); the account can sign in only after confirming. Signing in unconfirmed sends a fresh link. Locally, with `RESEND_API_KEY` empty, the link prints in the terminal like reset links do.
- Forgot password sends a one-time reset link that expires in 1 hour. The page always says "If an account exists for that email, we sent a reset link", so it never reveals which emails are registered.
- Resetting a password signs out every existing session; then you sign in with the new password.

## Resend

- Create an API key at resend.com and set it as `RESEND_API_KEY`. The key is only read on the server.
- Until you verify a sending domain, Resend only delivers to the email address that owns the Resend account. Use `onboarding@resend.dev` as the From address meanwhile. The Reports screen shows a note about this when `RESEND_FROM` uses `resend.dev`.
- To email anyone else, add your domain in Resend → Domains, create the DNS records it lists, wait for "Verified", then set `RESEND_FROM` to an address on that domain, e.g. `PocketPlan <reports@yourdomain.com>`.
- The app only ever says a report was "accepted by email provider". That is all Resend's response proves.

## Money rules

The full rules and their reasons are in [docs/plan.md](docs/plan.md) §3–§4.

- Amounts are stored as integer sen (RM 12.50 = 1250). No floats anywhere in the money path.
- Unallocated + the sum of envelope balances always equals total remaining. Balances are computed from the ledger, never stored.
- You cannot spend, allocate or transfer more than the source holds. Overspending is blocked.
- Mistakes are voided and re-entered, never edited or deleted. Voiding an expense voids its refunds.
- Refunds go back to the original envelope, stay linked to the expense, and can't exceed it.

## Project layout

```
src/app/            pages, layouts, route handlers (api/auth/[...all], api/reports/preview)
src/components/     ui/ shared primitives, plus one folder per feature
src/lib/            pure code: types, money, dates, validation (reusable by a future mobile app)
src/server/         server-only: db, auth, lock, envelopes, ledger, reports, email, actions/
prisma/             schema and migrations
tests/              vitest (money, envelopes, ledger invariant, reports)
docs/               plan.md (product rules), architecture.md (how the code fits)
```

More detail is in [docs/architecture.md](docs/architecture.md).
