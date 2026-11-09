"use server";

import { revalidatePath } from "next/cache";
import { actionUser } from "@/server/auth";
import { toResult } from "@/server/errors";
import { parseOrThrow } from "@/server/validate";
import { sendReport as send } from "@/server/reports/send";
import { sendReportSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

// actionUser() runs inside toResult: an ended session comes back as an UNAUTHORIZED result, never a redirect that drops the action.

export async function sendReport(input: unknown): Promise<ActionResult<{ status: "ACCEPTED" }>> {
  return toResult(async () => {
    const user = await actionUser();
    const data = parseOrThrow(sendReportSchema, input);
    await send({ id: user.id, email: user.email }, data); // data includes previewHash, checked against a fresh render
    revalidatePath("/reports");
    return { status: "ACCEPTED" as const };
  });
}
