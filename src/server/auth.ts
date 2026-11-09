import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email/send";

// Fail at startup, not on the first sign-in: a weak or missing secret makes sessions forgeable.
const secret = process.env.BETTER_AUTH_SECRET;
if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32)) {
  throw new Error("BETTER_AUTH_SECRET must be set to at least 32 characters in production. Generate one with: openssl rand -base64 32");
}

export const auth = betterAuth({
  // Default model names (user, session, account, verification) match the Prisma client delegates.
  database: prismaAdapter(db, { provider: "postgresql" }),
  secret,
  baseURL: process.env.BETTER_AUTH_URL,
  // Dev only: also trust the address the page was actually served from (127.0.0.1, a WSL IP, a forwarded
  // preview). Production stays strict: only BETTER_AUTH_URL is a trusted origin.
  trustedOrigins:
    process.env.NODE_ENV === "production"
      ? []
      : (request) => {
          if (!request) return [];
          const forwarded = request.headers.get("x-forwarded-host");
          const proto = request.headers.get("x-forwarded-proto") ?? "http";
          return [new URL(request.url).origin, forwarded ? `${proto}://${forwarded}` : null];
        },
  // Shared across serverless instances (the in-memory default is per instance). Off in dev so local retries never lock you out.
  rateLimit: { enabled: process.env.NODE_ENV === "production", storage: "database", modelName: "rateLimit" },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    // shortcut: no email verification until a Resend domain is verified; turn on requireEmailVerification then
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({ to: user.email, subject: "Reset your PocketPlan password", html: resetPasswordHtml(url) });
    },
    resetPasswordTokenExpiresIn: 3600,
    revokeSessionsOnPasswordReset: true,
  },
  plugins: [nextCookies()], // must stay last
});

// url is built by Better Auth from BETTER_AUTH_URL and a random token; only quotes need escaping in the attribute.
function resetPasswordHtml(url: string): string {
  const href = url.replace(/"/g, "%22");
  return `<p>Someone asked to reset the password for your PocketPlan account. Tap the link below to choose a new one.</p>
<p><a href="${href}">Reset your password</a></p>
<p>If you did not ask for this, ignore this email. The link expires in 1 hour.</p>`;
}

// One session lookup per request, shared by the layout and the page.
const getSessionUser = cache(async (): Promise<{ id: string; email: string } | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session ? { id: session.user.id, email: session.user.email } : null;
});

export async function requireUser(): Promise<{ id: string; email: string }> {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  return user;
}

export async function getOptionalUser(): Promise<{ id: string; email: string } | null> {
  return getSessionUser();
}
