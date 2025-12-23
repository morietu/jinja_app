import { NextResponse } from "next/server";

export async function GET(_: Request, { params }: { params: { username: string } }) {
  const base = process.env.DJANGO_API_BASE_URL ?? "http://127.0.0.1:8000/api";
  const url = `${base}/goshuins/public/${encodeURIComponent(params.username)}/`;

  const res = await fetch(url, { cache: "no-store" });
  const body = await res.text();

  const headers = new Headers(res.headers);
  // Next が変に推測しないよう、最低限の保険（Djangoが付けてればそのまま）
  if (!headers.get("content-type")) headers.set("content-type", "application/json; charset=utf-8");

  return new NextResponse(body, { status: res.status, headers });
}
