// apps/web/src/lib/bff/refreshMutex.ts
import type { NextRequest } from "next/server";

let refreshInFlight: Promise<{ setCookies: string[] } | null> | null = null;

function getSetCookies(r: Response): string[] {
  const anyHeaders = r.headers as any;
  const xs: string[] | undefined = anyHeaders.getSetCookie?.();
  if (Array.isArray(xs) && xs.length) return xs;

  const one = r.headers.get("set-cookie");
  if (!one) return [];
  // set-cookie が結合されて返るケースもあるので雑に分割（dev用途なら十分）
  return one
    .split(/,(?=[^;]+=[^;]+)/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function refreshJwtWithMutex(req: NextRequest, origin: string): Promise<{ setCookies: string[] } | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const cookie = req.headers.get("cookie") ?? "";
    const upstream = `${origin}/api/auth/jwt/refresh/`;

    const r = await fetch(upstream, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: "{}", // 送らなくても動くこと多いが、安定させる
      cache: "no-store",
    });

    if (!r.ok) return null;

    const setCookies = getSetCookies(r);
    return { setCookies };
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}
