import Link from "next/link";
import type { ReactNode } from "react";
import { EnvelopeSwatch, ProgressBar } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatSen } from "@/lib/money";
import type { EnvelopeView } from "@/lib/types";

/** Display-only ratio; amounts stay integer sen. */
export function targetProgress(e: EnvelopeView): number | null {
  return e.targetSen ? e.balanceSen / e.targetSen : null;
}

export function EnvelopeRow({ envelope, actions }: { envelope: EnvelopeView; actions?: ReactNode }) {
  const progress = targetProgress(envelope);
  return (
    <li className={cn("flex items-center gap-1 border-b border-border last:border-b-0", envelope.archivedAt && "opacity-60")}>
      <Link href={`/envelopes/${envelope.id}`} className="flex min-h-14 min-w-0 flex-1 flex-col justify-center gap-1.5 py-2">
        <span className="flex items-center gap-2">
          <EnvelopeSwatch colour={envelope.colour} icon={envelope.icon} />
          <span className="truncate font-medium">{envelope.name}</span>
          <span className="ml-auto shrink-0 tabular-nums">{formatSen(envelope.balanceSen)}</span>
        </span>
        {progress !== null && (
          <ProgressBar value={progress} colour={envelope.colour ?? "var(--muted-foreground)"} label={`${envelope.name} target progress`} />
        )}
      </Link>
      {actions}
    </li>
  );
}
