export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";
import { serverLog, getRequestId } from "@/lib/server/logging";

const DEBUG = process.env.NODE_ENV !== "production" && process.env.DEBUG_LOG === "1";


export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const incoming = await req.formData();
    const outgoing = new FormData();
    incoming.forEach((value, key) => {
      outgoing.append(key, value as any);
    });

    const upstream = await djFetch(req, "/api/users/me/icon/", {
      method: "POST",
      body: outgoing,
      headers: { Accept: "application/json" },
    });

    const text = await upstream.text();

    if (DEBUG) {
      serverLog("debug", "BFF_USER_ICON_UPSTREAM", {
        requestId,
        status: upstream.status,
        textLen: text.length,
      });
    }

    // upstream の Content-Type は headers.get は小文字で取るのが安全
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (err: unknown) {
    serverLog("error", "BFF_USER_ICON_FAILED", {
      requestId,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        detail: "BFF /api/users/me/icon でエラーが発生しました",
      },
      { status: 500 },
    );
  }
}
