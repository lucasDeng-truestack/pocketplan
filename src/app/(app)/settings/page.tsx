import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
import { getPreferences } from "@/server/preferences/service";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { AppearanceForm } from "@/components/settings/AppearanceForm";

export const metadata: Metadata = { title: "Settings · PocketPlan" };

const section = "flex flex-col gap-3 rounded-2xl border border-border bg-card p-4";

export default async function SettingsPage() {
  const user = await requireUser();
  const prefs = await getPreferences(user.id);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section aria-labelledby="appearance" className={`${section} lg:col-span-2`}>
        <h2 id="appearance" className="text-lg font-semibold">
          Appearance
        </h2>
        <AppearanceForm initial={prefs} />
      </section>

      <section aria-labelledby="account" className={section}>
        <h2 id="account" className="text-lg font-semibold">
          Account
        </h2>
        <p className="min-w-0 break-words text-sm">
          Signed in as <span className="font-medium">{user.email}</span>
        </p>
        <div className="self-start">
          <SignOutButton />
        </div>
      </section>

      <section aria-labelledby="about" className={section}>
        <h2 id="about" className="text-lg font-semibold">
          About
        </h2>
        <p className="text-sm text-muted-foreground">PocketPlan tracks money. It never holds funds or connects to banks.</p>
      </section>
    </div>
  );
}
