import { permanentRedirect } from "next/navigation";

/** History became Activity; old links and bookmarks keep their filters. */
export default async function HistoryPage({ searchParams }: PageProps<"/history">) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) qs.append(key, v);
  }
  const s = qs.toString();
  permanentRedirect(s ? `/activity?${s}` : "/activity");
}
