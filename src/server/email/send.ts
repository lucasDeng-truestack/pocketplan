import "server-only";
import { Resend } from "resend";
import { AppError } from "@/server/errors";

export async function sendEmail(input: {
  to: string | string[];
  subject: string;
  html: string;
  idempotencyKey?: string;
}): Promise<{ id: string }> {
  const key = process.env.RESEND_API_KEY;

  // shortcut: console delivery when no RESEND_API_KEY in dev; remove once a key is always present
  if (!key && process.env.NODE_ENV !== "production") {
    const link = input.html.match(/href="([^"]+)"/)?.[1];
    console.log(
      [
        "",
        "==================== DEV EMAIL (not sent) ====================",
        `To:      ${[input.to].flat().join(", ")}`,
        `Subject: ${input.subject}`,
        link ? `Link:    ${link}` : null,
        "==============================================================",
        "",
      ]
        .filter((line) => line !== null)
        .join("\n"),
    );
    return { id: "dev-console" };
  }

  if (!key || !process.env.RESEND_FROM) throw new AppError("EMAIL_FAILED", "Email is not configured");

  const { data, error } = await new Resend(key).emails.send(
    { from: process.env.RESEND_FROM, to: input.to, subject: input.subject, html: input.html },
    input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
  );
  if (error) throw new AppError("EMAIL_FAILED", error.message);
  return { id: data.id };
}
