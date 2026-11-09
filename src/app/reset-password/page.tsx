import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/server/auth";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = { title: "Reset password · PocketPlan" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  if (await getOptionalUser()) redirect("/");
  const { token, error } = await searchParams;
  // Better Auth sends ?error=INVALID_TOKEN for a missing or expired link, else ?token=…
  const valid = typeof token === "string" && token !== "" && !error ? token : null;
  return (
    <AuthLayout title="Choose a new password" subtitle="Use at least 8 characters.">
      <ResetPasswordForm token={valid} />
    </AuthLayout>
  );
}
