import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { bffPostJsonWithAuthFromReq } from "@/lib/server/bffFetch";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Stripe Customer Portal の遷移 URL を取得する BFF。
 *
 * Backend が正本なので、ここでは状態判定も解約処理も行わない。
 * backend の生エラー本文はユーザーへ渡さず、汎用コードだけを返す。
 */
export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const upstream = await bffPostJsonWithAuthFromReq(req, "/api/billings/portal/", {
    return_url: `${origin}/billing/manage`,
  });

  if (!upstream.ok) {
    if (upstream.status === 401 || upstream.status === 403) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (upstream.status === 409) {
      return NextResponse.json({ error: "billing_customer_missing" }, { status: 409 });
    }
    return NextResponse.json({ error: "billing_portal_unavailable" }, { status: 503 });
  }

  const text = await upstream.text().catch(() => "");
  let portalUrl: unknown;
  try {
    portalUrl = (JSON.parse(text) as { portal_url?: unknown }).portal_url;
  } catch {
    portalUrl = null;
  }

  if (typeof portalUrl !== "string" || !portalUrl) {
    return NextResponse.json({ error: "billing_portal_unavailable" }, { status: 503 });
  }

  return NextResponse.json({ portal_url: portalUrl }, { status: 200 });
}
