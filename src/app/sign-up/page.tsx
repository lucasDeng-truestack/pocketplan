import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/server/auth";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { SignUpForm } from "@/components/auth/SignUpForm";

export const metadata: Metadata = { title: "Create account · PocketPlan" };

export default async function SignUpPage() {
  if (await getOptionalUser()) redirect("/");
  return (
    <AuthLayout mode="up" title="Start your plan" subtitle="Give every ringgit a job, one envelope at a time.">
      <SignUpForm />
    </AuthLayout>
  );
}
