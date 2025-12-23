import { NextResponse } from "next/server";

export async function GET(_: Request, { params }: { params: { username: string } }) {
  const base = process.env.DJANGO_API_BASE_URL ?? "http://127.0.0.1:8000/api";
  const url = `${base}/goshuins/?username=${encodeURIComponent(params.username)}`;
  return NextResponse.json({ base, url }, { status: 200 });
}
