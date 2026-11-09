import "dotenv/config";
import { config as load } from "dotenv";
import { defineConfig } from "prisma/config";

load({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL },
});
