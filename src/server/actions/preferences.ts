"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { toResult } from "@/server/errors";
import { parseOrThrow } from "@/server/validate";
import { setPreferences as save } from "@/server/preferences/service";
import { preferencesSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

export async function setPreferences(input: unknown): Promise<ActionResult<void>> {
  const user = await requireUser();
  return toResult(async () => {
    await save(user.id, parseOrThrow(preferencesSchema, input));
    revalidatePath("/", "layout"); // <html data-theme> is set in the root layout
  });
}
