"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Mail } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button, Input } from "@/components/ui";
import { FormError, NETWORK_ERROR, TOO_MANY, looksLikeEmail } from "./shared";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const address = email.trim();
    if (!looksLikeEmail(address)) return setError("Enter a valid email address.");
    setPending(true);
    setError(null);
    try {
      const { error } = await authClient.requestPasswordReset({ email: address, redirectTo: "/reset-password" });
      // Same answer whether or not the address has an account: never reveal which emails are registered.
      if (error?.status === 429) setError(TOO_MANY);
      else setSent(true);
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-5" aria-live="polite">
        <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-primary/15 text-primary">
          <Mail className="size-6" />
        </span>
        <div>
          <h2 className="text-xl font-semibold">Check your email</h2>
          <p className="mt-1 text-muted-foreground">If an account exists for that email, we sent a reset link. It expires in 1 hour.</p>
        </div>
        <Link href="/sign-in" className="flex min-h-12 items-center justify-center rounded-xl border border-border bg-card px-4 font-medium">
          Back to sign in
        </Link>
        <button type="button" onClick={() => setSent(false)} className="min-h-11 text-sm font-medium underline">
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Input label="Email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      {error && <FormError>{error}</FormError>}
      <Button type="submit" pending={pending}>
        Send reset link
      </Button>
      <Link href="/sign-in" className="flex min-h-11 items-center justify-center text-sm font-medium underline">
        Back to sign in
      </Link>
    </form>
  );
}
