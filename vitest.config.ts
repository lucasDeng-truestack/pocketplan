import { defineConfig } from "vitest/config";
import { config as load } from "dotenv";

load({ path: ".env.local" });

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
  },
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
});
