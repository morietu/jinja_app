import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { bffFetchWithAuthFromReq } from "@/lib/bff/fetch";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STUB = {
  plan: "free",
  is_active: false,
  provider: "stub",
  current_period_end: null,
  trial_ends_at: null,
  cancel_at_period_end: false,
} as const;

export async function GET(req: NextRequest) {
  const upstream = await bffFetchWithAuthFromReq(req, "/api/billings/status/", {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!upstream.ok) {
    return NextResponse.json(STUB, { status: 200, headers: { "x-billing-stub": "1" } });
  }

  const text = await upstream.text().catch(() => "");
  try {
    return NextResponse.json(JSON.parse(text), { status: 200 });
  } catch {
    return NextResponse.json(STUB, { status: 200, headers: { "x-billing-stub": "1" } });
  }
}
