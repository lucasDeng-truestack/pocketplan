"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sendReport } from "@/server/actions/reports";
import { Button, ConfirmSheet, EnvelopeSwatch, Input } from "@/components/ui";
import { cn } from "@/lib/cn";
import { isISODate } from "@/lib/dates";
import { PREVIEW_STALE_MESSAGE, SELF_ONLY_MESSAGE } from "@/lib/validation";
import type { ErrorCode } from "@/lib/types";

type EnvelopeOption = { id: string; name: string; colour: string | null; archived: boolean };
type Params = { start: string; end: string; envelopeIds: string[]; includeNotes: boolean };
type Step = "choose" | "preview" | "send";
type Outcome = { ok: true } | { ok: false; code: ErrorCode | "NETWORK"; message: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RETRYABLE: (ErrorCode | "NETWORK")[] = ["EMAIL_FAILED", "NETWORK"];

function rangeError(start: string, end: string): string | null {
  if (!isISODate(start) || !isISODate(end)) return "Enter both dates";
  if (start > end) return "The start date must be on or before the end date";
  if ((Date.parse(end) - Date.parse(start)) / 86_400_000 > 366) return "Choose a range of a year or less";
  return null;
}

function previewUrl(p: Params): string {
  const q = new URLSearchParams({ start: p.start, end: p.end, envelopeIds: p.envelopeIds.join(","), includeNotes: p.includeNotes ? "1" : "0" });
  return `/api/reports/preview?${q}`;
}

function parseRecipients(text: string): { list: string[]; invalid: string[] } {
  const list = [...new Set(text.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean))];
  return { list, invalid: list.filter((r) => !EMAIL.test(r)) };
}

export function ReportBuilder({
  envelopes,
  defaultStart,
  defaultEnd,
  senderEmail,
  testSender,
  canSendToOthers,
}: {
  envelopes: EnvelopeOption[];
  defaultStart: string;
  defaultEnd: string;
  senderEmail: string;
  testSender: boolean;
  /** False until the account's email is verified: reports can then only go to the account's own address. */
  canSendToOthers: boolean;
}) {
  const router = useRouter();
  const ids = useId();
  const [step, setStep] = useState<Step>("choose");
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(envelopes.filter((e) => !e.archived).map((e) => e.id)));
  const [includeNotes, setIncludeNotes] = useState(false);
  // Frozen when Preview is pressed: what was previewed is exactly what gets sent.
  const [previewed, setPreviewed] = useState<Params | null>(null);
  // The exact HTML shown (srcDoc) and its server-computed hash, sent back so the server can refuse a changed report.
  const [preview, setPreview] = useState<{ html: string; hash: string } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const load = useRef<AbortController | null>(null);
  const [recipientText, setRecipientText] = useState(senderEmail);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const inFlight = useRef(false); // a double tap lands before the disabled state renders

  const dateError = rangeError(start, end);
  const canPreview = chosen.size > 0 && dateError === null;
  const { list: recipients, invalid } = useMemo(() => parseRecipients(recipientText), [recipientText]);
  const sendTo = canSendToOthers ? recipients : [senderEmail.toLowerCase()];
  const recipientError = !canSendToOthers
    ? null
    : recipients.length === 0 ? "Add at least one email address" : recipients.length > 10 ? "Send to 10 people or fewer" : invalid.length ? "Fix the addresses marked below" : null;
  const closeConfirm = useCallback(() => setConfirming(false), []); // stable: Sheet's focus effect depends on it

  function toggle(id: string) {
    setChosen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function loadPreview(p: Params) {
    load.current?.abort();
    const controller = new AbortController();
    load.current = controller;
    setPreview(null);
    setPreviewError(null);
    try {
      // 20 s cap: a stalled request shows the error state with Try again instead of "Loading preview…" forever.
      const timeout = setTimeout(() => controller.abort(new Error("timeout")), 20_000);
      const res = await fetch(previewUrl(p), { credentials: "same-origin", cache: "no-store", signal: controller.signal }).finally(() =>
        clearTimeout(timeout),
      );
      const body = await res.text();
      const hash = res.headers.get("X-Report-Hash");
      if (!res.ok || !hash) setPreviewError(res.ok ? "Could not load the preview. Try again." : body);
      else setPreview({ html: body, hash });
    } catch {
      if (controller.signal.reason instanceof Error && controller.signal.reason.message === "timeout") {
        setPreviewError("The preview is taking too long. Try again.");
      } else if (!controller.signal.aborted) setPreviewError("Could not load the preview. Check your connection.");
    }
  }

  function showPreview() {
    if (!canPreview) return;
    const p = { start, end, envelopeIds: envelopes.filter((e) => chosen.has(e.id)).map((e) => e.id), includeNotes };
    setPreviewed(p);
    setOutcome(null);
    setStep("preview");
    void loadPreview(p);
  }

  function change() {
    load.current?.abort();
    setStep("choose");
    setPreviewed(null);
    setPreview(null);
    setOutcome(null);
  }

  async function send() {
    if (!previewed || !preview || recipientError || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setOutcome(null);
    try {
      const result = await sendReport({ ...previewed, recipients: sendTo, previewHash: preview.hash });
      setOutcome(result.ok ? { ok: true } : { ok: false, code: result.code, message: result.message });
      if (result.ok) router.refresh();
      // The report changed since it was shown: show the fresh one; the message stays visible above it.
      if (!result.ok && result.message === PREVIEW_STALE_MESSAGE) {
        setStep("preview");
        void loadPreview(previewed);
      }
    } catch {
      setOutcome({ ok: false, code: "NETWORK", message: "Could not reach PocketPlan. Check your connection and try again." });
    } finally {
      inFlight.current = false;
      setPending(false);
      setConfirming(false);
    }
  }

  /** Opens the print dialog for the previewed report; the person picks "Save as PDF" (Share → Save to Files on iPhone). */
  function downloadPdf() {
    const win = frameRef.current?.contentWindow;
    if (!win || !previewed) return;
    // Chrome names the PDF after the top page's title; print() blocks, so the title is restored after.
    const title = document.title;
    document.title = `PocketPlan report ${previewed.start} to ${previewed.end}`;
    win.focus();
    win.print();
    document.title = title;
  }

  if (step === "choose" || !previewed) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          <Input label="From" type="date" value={start} max={end} onChange={(e) => setStart(e.target.value)} />
          <Input label="To" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
        </div>
        {dateError && <p className="-mt-2 text-sm text-destructive">{dateError}</p>}

        <fieldset className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <legend className="text-sm font-medium">Envelopes</legend>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => setChosen(new Set(envelopes.map((e) => e.id)))}>
                Select all
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setChosen(new Set())}>
                None
              </Button>
            </div>
          </div>
          {envelopes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-muted-foreground">Create an envelope to build a report.</p>
          ) : (
            <ul className="rounded-xl border border-border bg-card px-3">
              {envelopes.map((e) => (
                <li key={e.id} className="border-b border-border last:border-b-0">
                  <label className={cn("flex min-h-12 items-center gap-3", e.archived && "text-muted-foreground")}>
                    <input type="checkbox" checked={chosen.has(e.id)} onChange={() => toggle(e.id)} className="size-5 accent-[var(--primary)]" />
                    <EnvelopeSwatch colour={e.colour} />
                    <span className="min-w-0 flex-1 truncate">{e.archived ? `${e.name} (archived)` : e.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <label className="flex min-h-12 items-start gap-3">
          <input
            type="checkbox"
            checked={includeNotes}
            onChange={(e) => setIncludeNotes(e.target.checked)}
            aria-describedby={`${ids}-notes-help`}
            className="mt-1 size-5 accent-[var(--primary)]"
          />
          <span className="flex flex-col">
            <span className="font-medium">Include merchant and notes</span>
            <span id={`${ids}-notes-help`} className="text-sm text-muted-foreground">
              Off keeps your spending details private.
            </span>
          </span>
        </label>

        <Button onClick={showPreview} disabled={!canPreview}>
          Preview
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Preview</h2>
        <Button variant="ghost" size="sm" onClick={change} disabled={pending}>
          Change
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">This is exactly the email that will be sent.</p>

      <div className="relative overflow-hidden rounded-xl border border-border bg-white">
        {previewError ? (
          <div role="alert" className="flex h-[70dvh] flex-col items-center justify-center gap-3 p-4 text-center text-destructive">
            <p>{previewError}</p>
            <Button variant="secondary" onClick={() => void loadPreview(previewed)}>
              Try again
            </Button>
          </div>
        ) : preview ? (
          // srcDoc from a same-origin fetch. No allow-scripts, so nothing in it can run; allow-same-origin and
          // allow-modals only let this page call print() on it for the PDF download.
          <iframe ref={frameRef} title="Report preview" sandbox="allow-same-origin allow-modals" srcDoc={preview.html} className="h-[70dvh] w-full" />
        ) : (
          <p role="status" className="flex h-[70dvh] items-center justify-center text-muted-foreground">
            Loading preview…
          </p>
        )}
      </div>

      {step === "preview" ? (
        <>
          {outcome && !outcome.ok && (
            <p role="alert" className="text-sm text-destructive">
              {outcome.message}
            </p>
          )}
          <Button onClick={() => setStep("send")} disabled={!preview}>
            Choose recipients
          </Button>
          <Button variant="secondary" onClick={downloadPdf} disabled={!preview}>
            Download PDF
          </Button>
        </>
      ) : outcome?.ok ? (
        <div role="status" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <p className="font-medium">Accepted by email provider.</p>
          <p className="text-sm text-muted-foreground">It may take a few minutes to arrive. Check spam if it doesn&apos;t.</p>
          <Button variant="secondary" onClick={change}>
            Build another report
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${ids}-recipients`} className="text-sm font-medium">
              Recipients
            </label>
            <textarea
              id={`${ids}-recipients`}
              value={canSendToOthers ? recipientText : senderEmail}
              onChange={(e) => setRecipientText(e.target.value)}
              readOnly={!canSendToOthers}
              rows={3}
              aria-describedby={`${ids}-recipients-help`}
              className="rounded-xl border border-border bg-card px-3 py-2 text-base text-foreground"
            />
            <p id={`${ids}-recipients-help`} className="text-xs text-muted-foreground">
              {canSendToOthers ? "Separate addresses with commas or new lines. Up to 10." : SELF_ONLY_MESSAGE}
            </p>
            {testSender && (
              <p className="text-xs text-muted-foreground">Until a sending domain is verified, reports only reach the account owner&apos;s address.</p>
            )}
          </div>
          {canSendToOthers && recipients.length > 0 && (
            <ul aria-label="Recipients" className="flex flex-wrap gap-1">
              {recipients.map((r) => (
                <li
                  key={r}
                  className={cn(
                    "max-w-full truncate rounded-full border px-2 py-0.5 text-xs",
                    invalid.includes(r) ? "border-destructive text-destructive" : "border-border",
                  )}
                >
                  {invalid.includes(r) ? `${r} (not valid)` : r}
                </li>
              ))}
            </ul>
          )}
          {recipientError && <p className="text-sm text-destructive">{recipientError}</p>}
          {outcome && !outcome.ok && (
            <p role="alert" className="text-sm text-destructive">
              {outcome.message}
            </p>
          )}
          <Button onClick={() => setConfirming(true)} disabled={recipientError !== null || pending}>
            {outcome && !outcome.ok && RETRYABLE.includes(outcome.code) ? "Try again" : "Send report"}
          </Button>
        </div>
      )}

      <ConfirmSheet
        open={confirming}
        onClose={closeConfirm}
        onConfirm={send}
        pending={pending}
        title={`Send this report to ${sendTo.length} ${sendTo.length === 1 ? "person" : "people"}?`}
        message={sendTo.join(", ")}
        confirmLabel="Send report"
      />
    </div>
  );
}
