"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { toResult } from "@/server/errors";
import { parseOrThrow } from "@/server/validate";
import * as ledger from "@/server/ledger/service";
import {
  allocateSchema,
  correctTransactionSchema,
  recordExpenseSchema,
  recordIncomeSchema,
  recordRefundSchema,
  transactionIdSchema,
  transferSchema,
} from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

// requireUser() runs outside toResult: its redirect is a thrown signal that toResult would swallow.

function refresh() {
  revalidatePath("/", "layout"); // balances show on every screen
}

export async function recordIncome(input: unknown): Promise<ActionResult<void>> {
  const user = await requireUser();
  return toResult(async () => {
    await ledger.recordIncome(user.id, parseOrThrow(recordIncomeSchema, input));
    refresh();
  });
}

export async function recordExpense(input: unknown): Promise<ActionResult<void>> {
  const user = await requireUser();
  return toResult(async () => {
    await ledger.recordExpense(user.id, parseOrThrow(recordExpenseSchema, input));
    refresh();
  });
}

export async function allocate(input: unknown): Promise<ActionResult<void>> {
  const user = await requireUser();
  return toResult(async () => {
    await ledger.allocate(user.id, parseOrThrow(allocateSchema, input));
    refresh();
  });
}

export async function transfer(input: unknown): Promise<ActionResult<void>> {
  const user = await requireUser();
  return toResult(async () => {
    await ledger.transfer(user.id, parseOrThrow(transferSchema, input));
    refresh();
  });
}

export async function recordRefund(input: unknown): Promise<ActionResult<void>> {
  const user = await requireUser();
  return toResult(async () => {
    await ledger.recordRefund(user.id, parseOrThrow(recordRefundSchema, input));
    refresh();
  });
}

export async function voidTransaction(input: unknown): Promise<ActionResult<void>> {
  const user = await requireUser();
  return toResult(async () => {
    await ledger.voidTransaction(user.id, parseOrThrow(transactionIdSchema, input));
    refresh();
  });
}

export async function unvoidTransaction(input: unknown): Promise<ActionResult<void>> {
  const user = await requireUser();
  return toResult(async () => {
    await ledger.unvoidTransaction(user.id, parseOrThrow(transactionIdSchema, input));
    refresh();
  });
}

export async function correctTransaction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  return toResult(async () => {
    const r = await ledger.correctTransaction(user.id, parseOrThrow(correctTransactionSchema, input));
    refresh();
    return r;
  });
}
