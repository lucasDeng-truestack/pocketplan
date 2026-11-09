import Link from "next/link";
import type { ReactNode } from "react";
import { Mail } from "lucide-react";
import { cn } from "@/lib/cn";
import { EnvelopeFan, TotalTile, TrustPoints } from "./AuthShowcase";

const SWITCH = [
  { mode: "in", href: "/sign-in", label: "Sign in" },
  { mode: "up", href: "/sign-up", label: "Create account" },
] as const;

function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span aria-hidden="true" className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Mail className="size-5" />
      </span>
      <span className="font-heading text-lg font-semibold">PocketPlan</span>
    </span>
  );
}

/**
 * Phone: logo and envelope fan above a card-less form. Tablet (md): tinted band with the form in a 480px card
 * overlapping it. Desktop (lg): split screen, brand panel left, form right.
 */
export function AuthLayout({
  title,
  subtitle,
  mode,
  children,
}: {
  title: string;
  subtitle: string;
  /** Shows the Sign in / Create account switch on those two pages. */
  mode?: "in" | "up";
  children: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-background lg:grid lg:grid-cols-2">
      <div className="flex flex-col gap-4 px-5 pt-5 md:auth-tint md:items-center md:gap-5 md:px-12 md:pt-8 md:pb-24 md:text-center lg:items-stretch lg:gap-7 lg:border-r lg:border-border lg:px-14 lg:py-10 lg:text-left">
        <div className="md:self-start">
          <Logo />
        </div>
        <div className="hidden md:block">
          <p className="font-heading text-4xl leading-11 font-semibold tracking-tight lg:text-[44px] lg:leading-[52px]">
            Every ringgit <br className="hidden lg:inline" />
            has a job.
          </p>
          <p className="mt-3 hidden max-w-[440px] text-lg text-muted-foreground lg:block">
            Divide the money you have into envelopes and always know what&apos;s left.
          </p>
        </div>
        <div>
          <EnvelopeFan />
          <TotalTile className="relative -mt-2 hidden lg:block" />
        </div>
        <TrustPoints className="mt-auto hidden lg:flex" />
      </div>

      <div className="px-5 pt-4 pb-8 md:mx-auto md:-mt-[72px] md:w-[480px] md:rounded-2xl md:border md:border-border md:bg-card md:p-7 md:shadow-sm lg:m-0 lg:flex lg:w-auto lg:items-center lg:justify-center lg:rounded-none lg:border-0 lg:bg-transparent lg:p-10 lg:shadow-none">
        <div className="flex flex-col gap-5 lg:w-[400px]">
          {mode && (
            <nav aria-label="Account" className="flex rounded-xl bg-muted p-1">
              {SWITCH.map((s) => (
                <Link
                  key={s.mode}
                  href={s.href}
                  aria-current={s.mode === mode ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 flex-1 items-center justify-center rounded-lg px-3 text-sm font-medium text-muted-foreground",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    s.mode === mode && "bg-card text-foreground shadow-sm",
                  )}
                >
                  {s.label}
                </Link>
              ))}
            </nav>
          )}
          <div>
            <h1 className="text-xl font-semibold">{title}</h1>
            <p className="mt-1 text-muted-foreground">{subtitle}</p>
          </div>
          {children}
          <p className="text-center text-xs text-muted-foreground">
            PocketPlan tracks money you already have. It never connects to your bank.
          </p>
        </div>
      </div>

      <TrustPoints className="mx-auto mt-8 hidden w-[480px] pb-10 md:flex lg:hidden" />
    </main>
  );
}
