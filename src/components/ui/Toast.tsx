"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type ToastKind = "error" | "success";
type ToastAction = { label: string; href: string };
type ToastItem = { id: number; message: string; kind: ToastKind; action?: ToastAction };
type ToastFn = (t: { message: string; kind: ToastKind; action?: ToastAction }) => void;

const ToastContext = createContext<ToastFn | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const toast = useCallback<ToastFn>(({ message, kind, action }) => {
    const id = ++nextId;
    setToasts((ts) => [...ts, { id, message, kind, action }]);
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setToasts((ts) => ts.filter((t) => t.id !== id));
    }, action ? 8000 : 4000); // longer when there is something to tap
    timers.current.add(timer);
  }, []);

  return (
    <ToastContext value={toast}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-36 z-[60] mx-auto flex max-w-md flex-col gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "rounded-xl border bg-card px-4 py-3 text-sm shadow-lg",
              t.kind === "error" ? "border-destructive text-destructive" : "border-border text-foreground",
            )}
          >
            {t.message}
            {t.action && (
              <Link href={t.action.href} className="pointer-events-auto ml-2 inline-flex min-h-11 items-center font-medium underline">
                {t.action.label}
              </Link>
            )}
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast(): { toast: ToastFn } {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast must be used inside ToastProvider");
  return { toast };
}
