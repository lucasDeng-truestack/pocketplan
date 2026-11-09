import "server-only";
import { formatSen } from "@/lib/money";
import type { ActionResult, ErrorCode, Sen } from "@/lib/types";

export class AppError extends Error {
  constructor(public code: ErrorCode, message: string) {
    super(message);
    this.name = "AppError";
  }
}

export function insufficient(name: string, haveSen: Sen, needSen: Sen): AppError {
  return new AppError("INSUFFICIENT", `${name} has ${formatSen(haveSen)}, short by ${formatSen(needSen - haveSen)}`);
}

/** Wrap a server action body so every error becomes an ActionResult. */
export async function toResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, code: e.code, message: e.message };
    console.error(e);
    return { ok: false, code: "VALIDATION", message: "Something went wrong" };
  }
}
