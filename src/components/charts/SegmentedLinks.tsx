import Link from "next/link";
import { cn } from "@/lib/cn";

/** URL-driven segmented control: each option is a link, the current one carries aria-current. */
export function SegmentedLinks<T extends string>({
  label,
  param,
  options,
  current,
  keep = {},
}: {
  label: string;
  param: string;
  options: readonly { value: T; label: string }[];
  current: T;
  /** other params to carry over, e.g. { month: "2026-11" } */
  keep?: Record<string, string>;
}) {
  return (
    <nav aria-label={label} className="flex rounded-xl bg-muted p-1">
      {options.map((o) => (
        <Link
          key={o.value}
          href={`?${new URLSearchParams({ ...keep, [param]: o.value })}`}
          scroll={false}
          aria-current={o.value === current ? "page" : undefined}
          className={cn(
            "flex min-h-11 flex-1 items-center justify-center rounded-lg px-3 text-sm font-medium text-muted-foreground",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            o.value === current && "bg-card text-foreground shadow-sm",
          )}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}
