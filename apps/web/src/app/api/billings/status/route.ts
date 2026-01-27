import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { serverLog } from "@/lib/server/logging";

const DEBUG = process.env.NODE_ENV !== "production" && process.env.DEBUG_LOG === "1";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
if (DEBUG) serverLog("debug", "BFF_BILLING_API_BASE", { hasApiBase: !!API_BASE });

const STUB = {
  plan: "free",
  is_active: false,
  provider: "stub",
  current_period_end: null,
  trial_ends_at: null,
  cancel_at_period_end: false,
} as const;

async function refreshAccessToken(refresh: string) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/jwt/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return (data?.access as string | null) ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const access = cookieStore.get("access_token")?.value;
    const refresh = cookieStore.get("refresh_token")?.value;

    const doFetch = async (token?: string) => {
      try {
        return await fetch(`${API_BASE}/api/billings/status/`, {
          method: "GET",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: "no-store",
        });
      } catch {
        return null;
      }
    };

    // 1st try
    let res = await doFetch(access);

    // access expired → refresh → retry
    if (res?.status === 401 && refresh) {
      const newAccess = await refreshAccessToken(refresh);
      if (newAccess) {
        cookieStore.set("access_token", newAccess, {
          httpOnly: false,
          sameSite: "lax",
          path: "/",
        });
        res = await doFetch(newAccess);
      }
    }

    if (!res || !res.ok) {
      return NextResponse.json(STUB, { status: 200, headers: { "x-billing-stub": "1" } });
    }

    const text = await res.text().catch(() => "");
    try {
      return NextResponse.json(JSON.parse(text), { status: 200 });
    } catch {
      return NextResponse.json(STUB, { status: 200, headers: { "x-billing-stub": "1" } });
    }
  } catch (e) {
    serverLog("error", "BFF_BILLING_STATUS_FAILED", {
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(STUB, { status: 200, headers: { "x-billing-stub": "1" } });
  }
}
