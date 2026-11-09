"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui";
import type { ActionResult } from "@/lib/types";

/** A fixed success message, or one chosen from the result (which may report a partial failure as an error toast). */
export type SuccessToast = string | ((data: unknown) => { message: string; kind?: "success" | "error" });

/**
 * Runs one server action at a time. Failure: the message goes to `error` (shown inline, the sheet stays open).
 * Success: toast, onSuccess, then refresh the server data. Resolves to whether it succeeded.
 */
export function useRunAction() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false); // a double tap lands before the disabled state renders

  async function run(
    action: () => Promise<ActionResult<unknown>>,
    successMessage: SuccessToast,
    opts: { onSuccess?: () => void; toastAction?: { label: string; href: string } } = {},
  ): Promise<boolean> {
    if (inFlight.current) return false;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await action();
      if (!result.ok) {
        setError(result.message);
        return false;
      }
      const t = typeof successMessage === "string" ? { message: successMessage } : successMessage(result.data);
      toast({ message: t.message, kind: t.kind ?? "success", action: opts.toastAction });
      opts.onSuccess?.();
      router.refresh();
      return true;
    } catch {
      setError("Could not save. Check your connection and try again.");
      return false;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return { pending, error, setError, run };
}
