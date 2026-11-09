"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button, useToast, type ButtonProps } from "@/components/ui";

export function SignOutButton({ variant = "secondary" }: { variant?: ButtonProps["variant"] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    try {
      const { error } = await authClient.signOut();
      if (error) throw new Error(error.message);
      router.push("/sign-in");
      router.refresh();
    } catch {
      toast({ message: "Could not sign out. Try again.", kind: "error" });
      setPending(false);
    }
  }

  return (
    <Button variant={variant} onClick={onClick} pending={pending}>
      Sign out
    </Button>
  );
}
