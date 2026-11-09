"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { toResult } from "@/server/errors";
import { parseOrThrow } from "@/server/validate";
import * as envelopes from "@/server/envelopes/service";
import {
  createEnvelopeSchema,
  envelopeIdSchema,
  reorderEnvelopesSchema,
  updateEnvelopeSchema,
} from "@/lib/validation";
import type { ActionResult, EnvelopeView } from "@/lib/types";

// requireUser() runs outside toResult: its redirect is a thrown signal that toResult would swallow.

function refresh() {
  revalidatePath("/", "layout"); // every screen: the (app) layout feeds Quick add's envelope chips
}

export async function createEnvelope(input: unknown): Promise<ActionResult<EnvelopeView>> {
  const user = await requireUser();
  return toResult(async () => {
    const data = parseOrThrow(createEnvelopeSchema, input);
    const envelope = await envelopes.createEnvelope(user.id, data);
    refresh();
    return envelope;
  });
}

export async function updateEnvelope(input: unknown): Promise<ActionResult<EnvelopeView>> {
  const user = await requireUser();
  return toResult(async () => {
    const data = parseOrThrow(updateEnvelopeSchema, input);
    const envelope = await envelopes.updateEnvelope(user.id, data);
    refresh();
    return envelope;
  });
}

export async function reorderEnvelopes(input: unknown): Promise<ActionResult<void>> {
  const user = await requireUser();
  return toResult(async () => {
    const { ids } = parseOrThrow(reorderEnvelopesSchema, input);
    await envelopes.reorderEnvelopes(user.id, ids);
    refresh();
  });
}

export async function archiveEnvelope(input: unknown): Promise<ActionResult<void>> {
  const user = await requireUser();
  return toResult(async () => {
    const { id } = parseOrThrow(envelopeIdSchema, input);
    await envelopes.archiveEnvelope(user.id, id);
    refresh();
  });
}

export async function unarchiveEnvelope(input: unknown): Promise<ActionResult<void>> {
  const user = await requireUser();
  return toResult(async () => {
    const { id } = parseOrThrow(envelopeIdSchema, input);
    await envelopes.unarchiveEnvelope(user.id, id);
    refresh();
  });
}
