import { vi } from "vitest";

// Import this first in any test that loads src/server code: it swaps the app db for the test branch.
vi.mock("server-only", () => ({}));
vi.mock("@/server/db", async () => ({ db: (await import("./helpers")).testDb }));
