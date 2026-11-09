import "server-only";
import type * as z from "zod";
import { AppError } from "@/server/errors";

/** Parse untrusted input or throw VALIDATION with the first issue's message. */
export function parseOrThrow<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw new AppError("VALIDATION", result.error.issues[0]?.message ?? "Invalid input");
  return result.data;
}
