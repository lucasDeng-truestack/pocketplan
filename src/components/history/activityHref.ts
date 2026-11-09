/** Activity filters as they appear in the URL. view=recurring shows recurring items instead of entries. */
export type ActivityFilterValues = { q?: string; type?: string; envelopeId?: string; start?: string; end?: string };

export function activityHref(f: ActivityFilterValues & { cursor?: string; view?: "recurring" }): string {
  const qs = new URLSearchParams();
  if (f.view) qs.set("view", f.view);
  if (f.q) qs.set("q", f.q);
  if (f.type) qs.set("type", f.type);
  if (f.envelopeId) qs.set("envelope", f.envelopeId);
  if (f.start) qs.set("start", f.start);
  if (f.end) qs.set("end", f.end);
  if (f.cursor) qs.set("cursor", f.cursor);
  const s = qs.toString();
  return s ? `/activity?${s}` : "/activity";
}
