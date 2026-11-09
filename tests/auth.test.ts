import "./setup";
import { afterAll, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { auth } from "@/server/auth";
import { testDb } from "./helpers";

// Outside a Next request there is no cookie store; nextCookies() only needs these two calls to be harmless.
vi.mock("next/headers", () => ({ cookies: async () => ({ set: () => {}, get: () => undefined }), headers: async () => new Headers() }));
vi.mock("@/server/email/send", () => ({ sendEmail: vi.fn(async () => ({ id: "test" })) }));

const email = `auth-${Date.now()}@test.invalid`;

afterAll(async () => {
  await testDb.user.deleteMany({ where: { email } });
  await testDb.$disconnect();
});

describe("email + password", () => {
  it("signs up, rejects a duplicate and a wrong password, signs in", async () => {
    expect(db).toBe(testDb); // guard: Better Auth must be talking to the test database
    const signUp = await auth.api.signUpEmail({ body: { email, password: "first-pass-123", name: "auth" } });
    expect(signUp.user.email).toBe(email);
    expect(signUp.token).toBeTruthy(); // autoSignIn

    await expect(auth.api.signUpEmail({ body: { email, password: "other-pass-123", name: "auth" } })).rejects.toMatchObject({
      body: { code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" },
    });
    await expect(auth.api.signInEmail({ body: { email, password: "wrong-pass-999" } })).rejects.toMatchObject({
      body: { code: "INVALID_EMAIL_OR_PASSWORD" },
    });
    await expect(auth.api.signUpEmail({ body: { email: `short-${email}`, password: "short", name: "x" } })).rejects.toMatchObject({
      body: { code: "PASSWORD_TOO_SHORT" },
    });
    expect((await auth.api.signInEmail({ body: { email, password: "first-pass-123" } })).token).toBeTruthy();

    const account = await testDb.account.findFirstOrThrow({ where: { user: { email } } });
    expect(account.password).not.toContain("first-pass-123"); // stored hashed
  });
});

describe("rate limit storage", () => {
  // Production turns on rateLimit.storage = "database"; this proves Better Auth can write our RateLimit table.
  it("records attempts in the RateLimit table and answers 429 past the limit", async () => {
    const { betterAuth } = await import("better-auth");
    const { prismaAdapter } = await import("better-auth/adapters/prisma");
    const limited = betterAuth({
      database: prismaAdapter(testDb, { provider: "postgresql" }),
      secret: "x".repeat(32),
      baseURL: "http://localhost:4100",
      emailAndPassword: { enabled: true },
      rateLimit: { enabled: true, storage: "database", modelName: "rateLimit" },
    });
    const ip = `10.99.${Date.now() % 250}.${Math.floor(Math.random() * 250)}`;
    const attempt = () =>
      limited.handler(
        new Request("http://localhost:4100/api/auth/sign-in/email", {
          method: "POST",
          headers: { "content-type": "application/json", origin: "http://localhost:4100", "x-forwarded-for": ip },
          body: JSON.stringify({ email: "nobody@test.invalid", password: "wrong-pass-999" }),
        }),
      );
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await attempt()).status);
    try {
      expect(statuses).toContain(429);
      expect(await testDb.rateLimit.count({ where: { key: { contains: ip } } })).toBeGreaterThan(0);
    } finally {
      await testDb.rateLimit.deleteMany({ where: { key: { contains: ip } } });
    }
  });
});
