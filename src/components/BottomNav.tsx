"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ChartColumn, LayoutDashboard, Plus, ReceiptText, Wallet, type LucideIcon } from "lucide-react";
import { useQuickAdd } from "@/components/ledger/QuickAdd";
import { cn } from "@/lib/cn";

export const NAV_ITEMS: { href: string; label: string; icon: LucideIcon; also?: string[] }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/activity", label: "Activity", icon: ReceiptText, also: ["/history"] },
  { href: "/envelopes", label: "Envelopes", icon: Wallet, also: ["/allocate", "/reports"] },
  { href: "/insights", label: "Insights", icon: ChartColumn },
];

export function isNavActive(item: (typeof NAV_ITEMS)[number], pathname: string): boolean {
  if (item.href === "/") return pathname === "/";
  return [item.href, ...(item.also ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** While this tab's page loads behind the scenes, its pill breathes so the tap clearly registered. */
function PendingPulse() {
  const { pending } = useLinkStatus();
  return pending ? <span aria-hidden="true" className="absolute inset-0 animate-pulse rounded-full bg-accent motion-reduce:animate-none" /> : null;
}

function NavLink({ item, pathname }: { item: (typeof NAV_ITEMS)[number]; pathname: string }) {
  const active = isNavActive(item, pathname);
  const Icon = item.icon;
  const reduce = useReducedMotion();
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-xs focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
        active ? "font-semibold text-foreground" : "text-muted-foreground",
      )}
    >
      <span className="relative flex h-8 w-14 items-center justify-center">
        <PendingPulse />
        {/* one pill, shared by every tab: it slides to the active one (the bar stays mounted across pages) */}
        {active && (
          <motion.span
            layoutId="bottomnav-pill"
            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 46 }}
            className="absolute inset-0 rounded-full bg-accent"
          />
        )}
        <motion.span
          className="relative flex"
          animate={reduce ? undefined : { y: active ? -1 : 0, scale: active ? 1.1 : 1 }}
          transition={{ type: "spring", stiffness: 600, damping: 40 }}
        >
          <Icon aria-hidden="true" className="size-5" strokeWidth={active ? 2.4 : 2} />
        </motion.span>
      </span>
      {item.label}
    </Link>
  );
}

/** Phone and tablet (< 1024 px): Dashboard, Activity, raised + in the centre, Envelopes, Insights. */
export function BottomNav() {
  const pathname = usePathname();
  const openQuickAdd = useQuickAdd();
  const reduce = useReducedMotion();
  const [dashboard, activity, envelopes, insights] = NAV_ITEMS;
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto grid max-w-[720px] grid-cols-5 items-center px-2">
        <li>
          <NavLink item={dashboard} pathname={pathname} />
        </li>
        <li>
          <NavLink item={activity} pathname={pathname} />
        </li>
        <li className="flex justify-center">
          <motion.button
            type="button"
            aria-label="Quick add"
            onClick={() => openQuickAdd("expense")}
            whileTap={reduce ? undefined : { scale: 0.9 }}
            whileHover={reduce ? undefined : { scale: 1.05 }}
            transition={{ type: "spring", stiffness: 600, damping: 40 }}
            className="-mt-6 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Plus aria-hidden="true" className="size-7" strokeWidth={2.5} />
          </motion.button>
        </li>
        <li>
          <NavLink item={envelopes} pathname={pathname} />
        </li>
        <li>
          <NavLink item={insights} pathname={pathname} />
        </li>
      </ul>
    </nav>
  );
}
