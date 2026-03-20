import { cookies } from "next/headers";
import type { ConciergeThreadDetail } from "@/lib/api/concierge/types";

const WEB_BASE = process.env.PLAYWRIGHT_BASE_URL || process.env.NEXT_PUBLIC_WEB_BASE_URL || "http://localhost:3000";

export async function getConciergeThreadServer(tid: string): Promise<ConciergeThreadDetail> {
  const url = `${WEB_BASE}/api/concierge-threads/${encodeURIComponent(tid)}/`;

  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
  });

  if (!res.ok) {
    throw new Error(`getConciergeThreadServer failed: ${res.status}`);
  }

  return res.json();
}
