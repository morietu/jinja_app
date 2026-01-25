
import { NextResponse } from "next/server";


export const dynamic = "force-dynamic";
export const revalidate = 0;

function toInt(v: string | null, def: number) {
  const n = v ? Number(v) : def;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(50, toInt(url.searchParams.get("limit"), 12));

    const base = process.env.API_BASE ?? "http://127.0.0.1:8000";
    const r = await fetch(`${base}/api/goshuins/?limit=${limit}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      // ✅ credentials を渡さない（cookie混入を防ぐ）
    });

    const text = await r.text();
    return new NextResponse(text, {
      status: r.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "public goshuin feed failed", message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
