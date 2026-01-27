import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { serverLog, getRequestId } from "@/lib/server/logging";


export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(_);
  const backend = process.env.BACKEND_URL;
  if (!backend) return NextResponse.json({ error: "BACKEND_URL is missing" }, { status: 500 });

  try {
    const { id } = await ctx.params;

    // ✅ Next16: cookies() は await / toStringは信用しない
    const store = await cookies();
    const cookieHeader = store
      .getAll()
      .map(({ name, value }) => `${name}=${value}`)
      .join("; ");

    // ✅ 詳細は /data/ を叩く（/shrines/<pk>/ は backend がブロックしてる）
    const upstream = `${backend}/api/shrines/${id}/data/`;

    const res = await fetch(upstream, {
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
      cache: "no-store",
    });

    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
    });
  } catch (e) {
    serverLog("error", "BFF_SHRINE_PROXY_FAILED", {
      requestId,
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "proxy failed", detail: String(e) }, { status: 502 });
  }
}
