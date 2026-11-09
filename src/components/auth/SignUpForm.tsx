"use client";

import Link from "next/link";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Check, Circle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { Button, Input } from "@/components/ui";
import { FormError, NETWORK_ERROR, PasswordInput, TOO_MANY, fallbackMessage, looksLikeEmail } from "./shared";

export function SignUpForm() {
  const helpId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<ReactNode>(null);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const longEnough = password.length >= 8;
  const mismatch = confirm !== "" && confirm !== password ? "Passwords don't match" : null;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const address = email.trim();
    if (!looksLikeEmail(address)) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    if (password !== confirm) return setError("Passwords don't match");
    setPending(true);
    setError(null);
    try {
      // No name field: the part before @ is a sensible default and can be changed later.
      const { error } = await authClient.signUp.email({ email: address, password, name: address.split("@")[0], callbackURL: "/" });
      if (error) {
        setError(
          error.status === 422 || error.code?.startsWith("USER_ALREADY_EXISTS") ? (
            <>
              An account with this email already exists.{" "}
              <Link href="/sign-in" className="font-medium underline">
                Sign in instead.
              </Link>
            </>
          ) : error.code === "PASSWORD_TOO_SHORT" ? (
            "Use at least 8 characters for your password."
          ) : error.code === "PASSWORD_TOO_LONG" ? (
            "Use 128 characters or fewer for your password."
          ) : error.status === 429 ? (
            TOO_MANY
          ) : (
            fallbackMessage(error, "create your account")
          ),
        );
        setPending(false);
        return;
      }
      setSentTo(address);
    } catch {
      setError(NETWORK_ERROR);
      setPending(false);
    }
  }

  if (sentTo) {
    return (
      <div role="status" className="flex flex-col gap-3 text-sm">
        <p className="text-base font-medium">Check your email</p>
        <p>
          We sent a link to <span className="font-medium">{sentTo}</span>. Tap it to confirm your email and sign in. It expires in 24 hours.
        </p>
        <p className="text-muted-foreground">
          No email? Check spam, or{" "}
          <Link href="/sign-in" className="font-medium underline">
            sign in
          </Link>{" "}
          to get a new link.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Input label="Email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <PasswordInput label="Password" autoComplete="new-password" value={password} onChange={setPassword} describedBy={helpId} />
      <p id={helpId} className={cn("-mt-2 flex items-center gap-1.5 text-sm", longEnough ? "text-foreground" : "text-muted-foreground")}>
        {longEnough ? <Check className="size-4 text-primary" aria-hidden="true" /> : <Circle className="size-4" aria-hidden="true" />}
        At least 8 characters
      </p>
      <PasswordInput label="Confirm password" autoComplete="new-password" value={confirm} onChange={setConfirm} error={mismatch} />
      {error && <FormError>{error}</FormError>}
      <Button type="submit" pending={pending}>
        Create account
      </Button>
    </form>
  );
}
