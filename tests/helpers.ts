import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is not set; refusing to run DB tests");
if (url === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL equals DATABASE_URL; refusing to run DB tests");

export const testDb = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const created: string[] = [];

/** A throwaway User row. Call cleanupTestUsers() in afterAll; cascades remove its envelopes and transactions. */
export async function makeTestUser(): Promise<{ id: string; email: string }> {
  const id = `test_${randomUUID()}`;
  const user = await testDb.user.create({ data: { id, name: "Test", email: `${id}@test.invalid` } });
  created.push(user.id);
  return { id: user.id, email: user.email };
}

export async function cleanupTestUsers(): Promise<void> {
  await testDb.user.deleteMany({ where: { id: { in: created.splice(0) } } });
}
