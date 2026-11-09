"use server";

import { revalidatePath } from "next/cache";
import { actionUser } from "@/server/auth";
import { toResult } from "@/server/errors";
import { parseOrThrow } from "@/server/validate";
import * as recurring from "@/server/recurring/service";
import { createRecurringSchema, recurringIdSchema, recurringOccurrenceSchema, updateRecurringSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

// actionUser() runs inside toResult: an ended session comes back as an UNAUTHORIZED result, never a redirect that drops the action.

function refresh() {
  revalidatePath("/", "layout");
}

export async function createRecurring(input: unknown): Promise<ActionResult<{ id: string }>> {
  return toResult(async () => {
    const user = await actionUser();
    const r = await recurring.createRecurring(user.id, parseOrThrow(createRecurringSchema, input));
    refresh();
    return r;
  });
}

export async function updateRecurring(input: unknown): Promise<ActionResult<void>> {
  return toResult(async () => {
    const user = await actionUser();
    await recurring.updateRecurring(user.id, parseOrThrow(updateRecurringSchema, input));
    refresh();
  });
}

export async function pauseRecurring(input: unknown): Promise<ActionResult<void>> {
  return toResult(async () => {
    const user = await actionUser();
    await recurring.pauseRecurring(user.id, parseOrThrow(recurringIdSchema, input));
    refresh();
  });
}

export async function resumeRecurring(input: unknown): Promise<ActionResult<void>> {
  return toResult(async () => {
    const user = await actionUser();
    await recurring.resumeRecurring(user.id, parseOrThrow(recurringIdSchema, input));
    refresh();
  });
}

export async function stopRecurring(input: unknown): Promise<ActionResult<void>> {
  return toResult(async () => {
    const user = await actionUser();
    await recurring.stopRecurring(user.id, parseOrThrow(recurringIdSchema, input));
    refresh();
  });
}

export async function recordRecurring(input: unknown): Promise<ActionResult<void>> {
  return toResult(async () => {
    const user = await actionUser();
    await recurring.recordRecurring(user.id, parseOrThrow(recurringOccurrenceSchema, input));
    refresh();
  });
}

export async function skipRecurring(input: unknown): Promise<ActionResult<void>> {
  return toResult(async () => {
    const user = await actionUser();
    const { id, dueOn } = parseOrThrow(recurringOccurrenceSchema, input);
    await recurring.skipRecurring(user.id, { id, dueOn });
    refresh();
  });
}
