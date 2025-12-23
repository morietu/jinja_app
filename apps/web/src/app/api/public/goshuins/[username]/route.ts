import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: { username: string } }) {
  const { username } = params;

  const base = process.env.DJANGO_API_BASE_URL ?? "http://127.0.0.1:8000/api";

  const incoming = new URL(req.url);
  const qs = incoming.searchParams.toString(); // limit/offset を受け取る

  const url = `${base}/goshuins/public/${encodeURIComponent(username)}/${qs ? `?${qs}` : ""}`;

  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();

  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}
