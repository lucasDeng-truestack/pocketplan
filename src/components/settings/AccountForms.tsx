"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Button, Input } from "@/components/ui";
import { FormError, NETWORK_ERROR, PasswordInput, TOO_MANY, fallbackMessage, looksLikeEmail } from "@/components/auth/shared";

type Open = "email" | "password" | null;

/** Change email and change password, each opened from a button so the Account card stays short. */
export function AccountForms({ email }: { email: string }) {
  const [open, setOpen] = useState<Open>(null);
  const [done, setDone] = useState<string | null>(null);
  const finish = (message: string) => {
    setOpen(null);
    setDone(message);
  };
  const show = (which: Open) => {
    setDone(null);
    setOpen(which);
  };

  return (
    <div className="flex flex-col gap-3">
      {done && (
        <p role="status" className="text-sm">
          {done}
        </p>
      )}
      {open === "email" ? (
        <ChangeEmailForm current={email} onDone={finish} onCancel={() => setOpen(null)} />
      ) : open === "password" ? (
        <ChangePasswordForm onDone={finish} onCancel={() => setOpen(null)} />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => show("email")}>
            Change email
          </Button>
          <Button variant="secondary" size="sm" onClick={() => show("password")}>
            Change password
          </Button>
        </div>
      )}
    </div>
  );
}

function ChangeEmailForm({ current, onDone, onCancel }: { current: string; onDone: (m: string) => void; onCancel: () => void }) {
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const address = newEmail.trim().toLowerCase();
    if (!looksLikeEmail(address)) return setError("Enter a valid email address.");
    if (address === current.toLowerCase()) return setError("That is already your email.");
    setPending(true);
    setError(null);
    try {
      const { error } = await authClient.changeEmail({ newEmail: address, callbackURL: "/settings" });
      if (error) {
        setError(error.status === 429 ? TOO_MANY : fallbackMessage(error, "start the email change"));
        setPending(false);
        return;
      }
      onDone(`We sent a link to ${current}. Approve the change there, then confirm from ${address}. Your email stays the same until then.`);
    } catch {
      setError(NETWORK_ERROR);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <Input label="New email" type="email" autoComplete="email" inputMode="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
      {error && <FormError>{error}</FormError>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" pending={pending}>
          Send confirmation
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ChangePasswordForm({ onDone, onCancel }: { onDone: (m: string) => void; onCancel: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const mismatch = confirm !== "" && confirm !== newPassword ? "Passwords don't match" : null;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    if (!currentPassword) return setError("Enter your current password.");
    if (newPassword.length < 8) return setError("Use at least 8 characters for your new password.");
    if (newPassword !== confirm) return setError("Passwords don't match");
    setPending(true);
    setError(null);
    try {
      const { error } = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
      if (error) {
        setError(
          error.code === "INVALID_PASSWORD"
            ? "Your current password is incorrect."
            : error.code === "PASSWORD_TOO_LONG"
              ? "Use 128 characters or fewer for your password."
              : error.status === 429
                ? TOO_MANY
                : fallbackMessage(error, "change your password"),
        );
        setPending(false);
        return;
      }
      onDone("Password changed. Your other devices were signed out.");
    } catch {
      setError(NETWORK_ERROR);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <PasswordInput label="Current password" autoComplete="current-password" value={currentPassword} onChange={setCurrentPassword} />
      <PasswordInput label="New password" autoComplete="new-password" value={newPassword} onChange={setNewPassword} />
      <PasswordInput label="Confirm new password" autoComplete="new-password" value={confirm} onChange={setConfirm} error={mismatch} />
      {error && <FormError>{error}</FormError>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" pending={pending}>
          Change password
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
