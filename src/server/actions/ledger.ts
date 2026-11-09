"use server";

import { revalidatePath } from "next/cache";
import { actionUser } from "@/server/auth";
import { toResult } from "@/server/errors";
import { parseOrThrow } from "@/server/validate";
import * as ledger from "@/server/ledger/service";
import {
  allocateSchema,
  correctTransactionSchema,
  recordExpenseSchema,
  recordIncomeSchema,
  recordRefundSchema,
  deleteEnvelopeSchema,
  transactionIdSchema,
  undoSplitSchema,
  transferSchema,
} from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

// actionUser() runs inside toResult: an ended session comes back as an UNAUTHORIZED result, never a redirect that drops the action.

function refresh() {
  revalidatePath("/", "layout"); // balances show on every screen
}

export async function recordIncome(input: unknown): Promise<ActionResult<void>> {
  return toResult(async () => {
    const user = await actionUser();
    await ledger.recordIncome(user.id, parseOrThrow(recordIncomeSchema, input));
    refresh();
  });
}

export async function recordExpense(input: unknown): Promise<ActionResult<void>> {
  return toResult(async () => {
    const user = await actionUser();
    await ledger.recordExpense(user.id, parseOrThrow(recordExpenseSchema, input));
    refresh();
  });
}

export async function allocate(input: unknown): Promise<ActionResult<void>> {
  return toResult(async () => {
    const user = await actionUser();
    await ledger.allocate(user.id, parseOrThrow(allocateSchema, input));
    refresh();
  });
}

export async function transfer(input: unknown): Promise<ActionResult<void>> {
  return toResult(async () => {
    const user = await actionUser();
    await ledger.transfer(user.id, parseOrThrow(transferSchema, input));
    refresh();
  });
}

export async function recordRefund(input: unknown): Promise<ActionResult<void>> {
  return toResult(async () => {
    const user = await actionUser();
    await ledger.recordRefund(user.id, parseOrThrow(recordRefundSchema, input));
    refresh();
  });
}

export async function voidTransaction(input: unknown): Promise<ActionResult<void>> {
  return toResult(async () => {
    const user = await actionUser();
    await ledger.voidTransaction(user.id, parseOrThrow(transactionIdSchema, input));
    refresh();
  });
}

export async function unvoidTransaction(input: unknown): Promise<ActionResult<void>> {
  return toResult(async () => {
    const user = await actionUser();
    await ledger.unvoidTransaction(user.id, parseOrThrow(transactionIdSchema, input));
    refresh();
  });
}

export async function correctTransaction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return toResult(async () => {
    const user = await actionUser();
    const r = await ledger.correctTransaction(user.id, parseOrThrow(correctTransactionSchema, input));
    refresh();
    return r;
  });
}

export async function undoSplit(input: unknown): Promise<ActionResult<{ count: number }>> {
  return toResult(async () => {
    const user = await actionUser();
    const result = await ledger.undoSplit(user.id, parseOrThrow(undoSplitSchema, input));
    refresh();
    return result;
  });
}

export async function deleteIncome(input: unknown): Promise<ActionResult<void>> {
  return toResult(async () => {
    const user = await actionUser();
    await ledger.deleteIncome(user.id, parseOrThrow(transactionIdSchema, input));
    refresh();
  });
}

export async function deleteEnvelope(input: unknown): Promise<ActionResult<void>> {
  return toResult(async () => {
    const user = await actionUser();
    await ledger.deleteEnvelope(user.id, parseOrThrow(deleteEnvelopeSchema, input));
    refresh();
  });
}
