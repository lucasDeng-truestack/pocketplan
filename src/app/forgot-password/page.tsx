import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/server/auth";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = { title: "Forgot password · PocketPlan" };

export default async function ForgotPasswordPage() {
  if (await getOptionalUser()) redirect("/");
  return (
    <AuthLayout title="Forgot your password?" subtitle="Enter your email and we will send you a link to choose a new one.">
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
