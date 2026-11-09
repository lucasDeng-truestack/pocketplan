import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/server/auth";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { SignInForm } from "@/components/auth/SignInForm";

export const metadata: Metadata = { title: "Sign in · PocketPlan" };

export default async function SignInPage() {
  if (await getOptionalUser()) redirect("/");
  return (
    <AuthLayout mode="in" title="Welcome back" subtitle="Sign in to see what's left in each envelope.">
      <SignInForm />
    </AuthLayout>
  );
}
