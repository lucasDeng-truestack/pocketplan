import { Check } from "lucide-react";
import { ENVELOPE_COLOURS } from "@/lib/types";
import { cn } from "@/lib/cn";

// Decorative sample data, never real balances: these pages show before anyone is signed in.
const [FOOD, , , BILLS, , , FUN, TRANSPORT] = ENVELOPE_COLOURS;

// Left to right in DOM order: each card covers only the right edge of the one before, so names and amounts stay readable.
const FAN = [
  { name: "Bills", colour: BILLS, amount: "RM 1,200.00", sub: "Target met", x: 0, y: 26, r: -6 },
  { name: "Transport", colour: TRANSPORT, amount: "RM 318.00", sub: "of RM 300.00", x: 118, y: 8, r: -2 },
  { name: "Food", colour: FOOD, amount: "RM 581.50", sub: "of RM 600.00", x: 236, y: 0, r: 2 },
  { name: "Fun", colour: FUN, amount: "RM 150.00", sub: "No target", x: 354, y: 20, r: 6 },
];

const SPLIT = [
  { colour: FOOD, weight: 581.5 },
  { colour: TRANSPORT, weight: 318 },
  { colour: BILLS, weight: 1200 },
  { colour: FUN, weight: 150 },
];

const TRUST = [
  ["Tracks money, never holds it.", "No bank link, no payments."],
  ["Private by default.", "Reports go only when you press Send."],
  ["Exact to the sen.", "No rounding, ever."],
];

/** Fan of sample envelopes: 62% on phones, 90% on tablets, full size on desktop. */
export function EnvelopeFan({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("relative h-[106px] w-full md:h-[153px] lg:h-[170px]", className)}>
      <div className="absolute top-0 left-1/2 h-[170px] w-[522px] -translate-x-1/2 origin-top scale-[.62] md:scale-90 lg:scale-100">
        {FAN.map((e) => (
          <div
            key={e.name}
            className="absolute flex h-28 w-42 flex-col gap-0.5 overflow-hidden rounded-xl border border-border bg-card px-3.5 pt-[42px] pb-3 text-left text-card-foreground shadow-md"
            style={{ left: e.x, top: e.y, transform: `rotate(${e.r}deg)` }}
          >
            <span
              className="absolute inset-x-0 top-0 h-[30px]"
              style={{ background: e.colour, clipPath: "polygon(0 0, 100% 0, 50% 100%)" }}
            />
            <span className="text-sm text-muted-foreground">{e.name}</span>
            <span className="font-semibold tabular-nums">{e.amount}</span>
            <span className="text-xs text-muted-foreground">{e.sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TotalTile({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("mx-auto w-full max-w-[420px] rounded-2xl border border-border bg-card px-5 py-4 shadow-sm", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Total remaining</p>
          <p className="mt-0.5 text-[28px] leading-9 font-semibold tabular-nums">RM 2,949.50</p>
        </div>
        <p className="text-sm whitespace-nowrap text-muted-foreground tabular-nums">RM 700.00 unallocated</p>
      </div>
      <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full">
        {SPLIT.map((s) => (
          <span key={s.colour} style={{ flex: s.weight, background: s.colour }} />
        ))}
        <span className="bg-muted" style={{ flex: 700 }} />
      </div>
    </div>
  );
}

export function TrustPoints({ className }: { className?: string }) {
  return (
    <ul aria-hidden="true" className={cn("flex flex-col gap-2.5", className)}>
      {TRUST.map(([title, sub]) => (
        <li key={title} className="flex items-center gap-3 text-[15px] leading-[22px]">
          <span className="grid size-7 flex-none place-items-center rounded-full bg-primary/15 text-primary">
            <Check className="size-4" />
          </span>
          <span>
            <span className="font-medium">{title}</span> <span className="text-muted-foreground">{sub}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
