"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { toResult } from "@/server/errors";
import { parseOrThrow } from "@/server/validate";
import { sendReport as send } from "@/server/reports/send";
import { sendReportSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

// requireUser() runs outside toResult: its redirect is a thrown signal that toResult would swallow.

export async function sendReport(input: unknown): Promise<ActionResult<{ status: "ACCEPTED" }>> {
  const user = await requireUser();
  return toResult(async () => {
    const data = parseOrThrow(sendReportSchema, input);
    await send({ id: user.id, email: user.email }, data); // data includes previewHash, checked against a fresh render
    revalidatePath("/reports");
    return { status: "ACCEPTED" as const };
  });
}
