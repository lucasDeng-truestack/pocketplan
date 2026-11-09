"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button, Input } from "@/components/ui";
import { FormError, NETWORK_ERROR, PasswordInput, TOO_MANY, fallbackMessage, looksLikeEmail } from "./shared";

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const address = email.trim();
    if (!looksLikeEmail(address)) return setError("Enter a valid email address.");
    if (!password) return setError("Enter your password.");
    setPending(true);
    setError(null);
    try {
      const { error } = await authClient.signIn.email({ email: address, password, callbackURL: "/" });
      if (error) {
        setError(
          error.status === 401 || error.code === "INVALID_EMAIL_OR_PASSWORD"
            ? "Email or password is incorrect"
            : error.status === 429
              ? TOO_MANY
              : fallbackMessage(error, "sign in"),
        );
        setPending(false);
        return;
      }
      router.push("/");
      router.refresh(); // keep the button pending until the dashboard replaces this page
    } catch {
      setError(NETWORK_ERROR);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Input label="Email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <PasswordInput
        label="Password"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
        aside={
          <Link href="/forgot-password" className="text-sm font-medium underline">
            Forgot password?
          </Link>
        }
      />
      {error && <FormError>{error}</FormError>}
      <Button type="submit" pending={pending}>
        Sign in
      </Button>
    </form>
  );
}
