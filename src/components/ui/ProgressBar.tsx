export type ProgressBarProps = {
  /** 0–1; clamped. */
  value: number;
  colour: string;
  label?: string;
};

export function ProgressBar({ value, colour, label = "Progress" }: ProgressBarProps) {
  const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const pct = Math.round(clamped * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colour }} />
    </div>
  );
}
