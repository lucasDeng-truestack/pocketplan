"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button, useToast } from "@/components/ui";
import { FormError, NETWORK_ERROR, PasswordInput, TOO_MANY, fallbackMessage } from "./shared";

function Expired() {
  return (
    <div className="flex flex-col gap-4">
      <p role="alert">This reset link has expired. Request a new one.</p>
      <Link href="/forgot-password" className="flex min-h-12 items-center justify-center rounded-xl bg-primary px-4 font-medium text-primary-foreground">
        Request a new link
      </Link>
    </div>
  );
}

export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(token === null);
  const [pending, setPending] = useState(false);
  const mismatch = confirm !== "" && confirm !== password ? "Passwords don't match" : null;

  if (expired || !token) return <Expired />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || !token) return;
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    if (password !== confirm) return setError("Passwords don't match");
    setPending(true);
    setError(null);
    try {
      const { error } = await authClient.resetPassword({ newPassword: password, token });
      if (error) {
        if (error.code === "INVALID_TOKEN") setExpired(true);
        else setError(error.status === 429 ? TOO_MANY : fallbackMessage(error, "update your password"));
        setPending(false);
        return;
      }
      toast({ message: "Password updated. Sign in with your new password.", kind: "success" });
      router.push("/sign-in");
    } catch {
      setError(NETWORK_ERROR);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <PasswordInput label="New password" autoComplete="new-password" value={password} onChange={setPassword} />
      <p className="-mt-2 text-sm text-muted-foreground">At least 8 characters</p>
      <PasswordInput label="Confirm new password" autoComplete="new-password" value={confirm} onChange={setConfirm} error={mismatch} />
      {error && <FormError>{error}</FormError>}
      <Button type="submit" pending={pending}>
        Update password
      </Button>
    </form>
  );
}
