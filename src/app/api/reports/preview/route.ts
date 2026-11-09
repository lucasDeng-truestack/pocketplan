import { auth } from "@/server/auth";
import { AppError } from "@/server/errors";
import { buildReport } from "@/server/reports/build";
import { renderReport } from "@/server/reports/render";
import { htmlHash } from "@/server/reports/send";
import { reportParamsSchema } from "@/lib/validation";

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export async function GET(request: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return text("Sign in to preview reports.", 401);

  const q = new URL(request.url).searchParams;
  const parsed = reportParamsSchema.safeParse({
    start: q.get("start") ?? "",
    end: q.get("end") ?? "",
    envelopeIds: (q.get("envelopeIds") ?? "").split(",").filter(Boolean),
    includeNotes: q.get("includeNotes") === "1",
  });
  if (!parsed.success) return text(parsed.error.issues[0]?.message ?? "Invalid report settings", 400);

  try {
    const html = renderReport(await buildReport(session.user.id, parsed.data), { senderEmail: session.user.email });
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
        // The client sends this back with the send request, so the server can refuse if the report changed.
        "X-Report-Hash": htmlHash(html),
      },
    });
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") return text(e.message, 404);
    if (e instanceof AppError) return text(e.message, 400);
    console.error(e);
    return text("Something went wrong", 500);
  }
}
