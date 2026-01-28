"use client";

export async function postConciergeChat<T = any>(payload: unknown): Promise<T> {
  const r = await fetch("/api/concierge/chat/", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });

  if (r.status === 401 || r.status === 403) throw new Error("unauthorized");
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`chat failed: ${r.status} ${text.slice(0, 120)}`);
  }
  return (await r.json()) as T;
}
