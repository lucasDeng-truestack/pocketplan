"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Plus, Settings } from "lucide-react";
import { NAV_ITEMS, isNavActive } from "@/components/BottomNav";
import { useQuickAdd } from "@/components/ledger/QuickAdd";
import { ModeToggle } from "@/components/settings/ModeToggle";
import { cn } from "@/lib/cn";

const linkClass = (active: boolean) =>
  cn(
    "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring",
    active ? "bg-accent font-semibold text-accent-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  );

/** Desktop (>= 1024 px): the same destinations as the bottom bar, plus Settings at the bottom. */
export function SideNav() {
  const pathname = usePathname();
  const openQuickAdd = useQuickAdd();
  const reduce = useReducedMotion();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col gap-6 border-r border-border bg-card px-3 py-5 lg:flex"
    >
      <Link href="/" className="px-3 font-heading text-lg font-semibold">
        PocketPlan
      </Link>
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(item, pathname);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn("relative", linkClass(active), active && "bg-transparent")}
              >
                {/* the highlight slides between items instead of jumping */}
                {active && (
                  <motion.span
                    layoutId="sidenav-pill"
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 46 }}
                    className="absolute inset-0 rounded-xl bg-accent"
                  />
                )}
                <Icon aria-hidden="true" className="relative size-5" />
                <span className="relative">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => openQuickAdd("expense")}
        className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-3 font-medium text-primary-foreground shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Plus aria-hidden="true" className="size-5" />
        Add
      </button>
      <div className="mt-auto flex items-center gap-1">
        <Link
          href="/settings"
          aria-current={pathname.startsWith("/settings") ? "page" : undefined}
          className={cn("flex-1", linkClass(pathname.startsWith("/settings")))}
        >
          <Settings aria-hidden="true" className="size-5" />
          Settings
        </Link>
        <ModeToggle />
      </div>
    </nav>
  );
}
