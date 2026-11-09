import Link from "next/link";
import { cn } from "@/lib/cn";

const TABS = [
  { value: "envelopes", label: "Envelopes", href: "/envelopes" },
  { value: "reports", label: "Reports", href: "/reports" },
] as const;

/** Envelopes · Reports segments; path links styled like SegmentedLinks. */
export function EnvelopesTabs({ current }: { current: (typeof TABS)[number]["value"] }) {
  return (
    <nav aria-label="Envelopes sections" className="flex rounded-xl bg-muted p-1">
      {TABS.map((t) => (
        <Link
          key={t.value}
          href={t.href}
          aria-current={t.value === current ? "page" : undefined}
          className={cn(
            "flex min-h-11 flex-1 items-center justify-center rounded-lg px-3 text-sm font-medium text-muted-foreground",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            t.value === current && "bg-card text-foreground shadow-sm",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
