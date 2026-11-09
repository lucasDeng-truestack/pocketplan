"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Share2 } from "lucide-react";
import { ModeToggle } from "@/components/settings/ModeToggle";

/** Derived from the path so pages need no title prop. */
export function pageTitle(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  if (pathname.startsWith("/activity") || pathname.startsWith("/history")) return "Activity";
  if (pathname.startsWith("/envelopes/")) return "Envelope";
  if (pathname.startsWith("/envelopes") || pathname.startsWith("/reports")) return "Envelopes";
  if (pathname.startsWith("/allocate")) return "Split money";
  if (pathname.startsWith("/insights")) return "Insights";
  if (pathname.startsWith("/settings")) return "Settings";
  return "PocketPlan";
}

const iconLink =
  "flex size-11 items-center justify-center rounded-full text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function TopBar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[720px] items-center justify-between gap-2 px-4 lg:h-16 lg:max-w-[1680px] lg:px-8">
        <h1 className="truncate text-xl font-semibold lg:text-2xl">{pageTitle(pathname)}</h1>
        <div className="flex shrink-0 items-center gap-1">
          <ModeToggle className="lg:hidden" />
          <Link href="/reports" aria-label="Share report" className={iconLink}>
            <Share2 aria-hidden="true" className="size-5" />
          </Link>
          <Link href="/settings" aria-label="Settings" className={`${iconLink} lg:hidden`}>
            <Settings aria-hidden="true" className="size-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
