"use server";

import { revalidatePath } from "next/cache";
import { actionUser } from "@/server/auth";
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

// actionUser() runs inside toResult: an ended session comes back as an UNAUTHORIZED result, never a redirect that drops the action.

function refresh() {
  revalidatePath("/", "layout"); // every screen: the (app) layout feeds Quick add's envelope chips
}

export async function createEnvelope(input: unknown): Promise<ActionResult<EnvelopeView>> {
  return toResult(async () => {
    const user = await actionUser();
    const data = parseOrThrow(createEnvelopeSchema, input);
    const envelope = await envelopes.createEnvelope(user.id, data);
    refresh();
    return envelope;
  });
}

export async function updateEnvelope(input: unknown): Promise<ActionResult<EnvelopeView>> {
  return toResult(async () => {
    const user = await actionUser();
    const data = parseOrThrow(updateEnvelopeSchema, input);
    const envelope = await envelopes.updateEnvelope(user.id, data);
    refresh();
    return envelope;
  });
}

export async function reorderEnvelopes(input: unknown): Promise<ActionResult<void>> {
  return toResult(async () => {
    const user = await actionUser();
    const { ids } = parseOrThrow(reorderEnvelopesSchema, input);
    await envelopes.reorderEnvelopes(user.id, ids);
    refresh();
  });
}

export async function archiveEnvelope(input: unknown): Promise<ActionResult<void>> {
  return toResult(async () => {
    const user = await actionUser();
    const { id } = parseOrThrow(envelopeIdSchema, input);
    await envelopes.archiveEnvelope(user.id, id);
    refresh();
  });
}

export async function unarchiveEnvelope(input: unknown): Promise<ActionResult<void>> {
  return toResult(async () => {
    const user = await actionUser();
    const { id } = parseOrThrow(envelopeIdSchema, input);
    await envelopes.unarchiveEnvelope(user.id, id);
    refresh();
  });
}
