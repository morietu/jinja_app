import { NextResponse } from "next/server";

export async function GET(req: Request) {
  // DjangoのURL（環境変数があればそれを優先）
  const base = process.env.BACKEND_ORIGIN ?? "http://localhost:8000";
  const url = new URL("/goriyaku-tags/", base);

  const auth = req.headers.get("authorization") ?? "";
  const cookie = req.headers.get("cookie") ?? "";

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      accept: "application/json",
      ...(auth ? { authorization: auth } : {}),
      ...(cookie ? { cookie } : {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}
