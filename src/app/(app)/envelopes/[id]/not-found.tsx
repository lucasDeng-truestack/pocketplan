import Link from "next/link";

export default function EnvelopeNotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <p className="text-muted-foreground">This envelope doesn&apos;t exist or isn&apos;t yours.</p>
      <Link href="/envelopes" className="flex min-h-11 items-center font-medium underline">
        Back to envelopes
      </Link>
    </div>
  );
}
