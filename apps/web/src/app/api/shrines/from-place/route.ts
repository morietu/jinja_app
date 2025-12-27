import { NextResponse } from "next/server";
import { bffPostJsonWithAuth } from "@/lib/bff/fetch";

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  return bffPostJsonWithAuth("/api/shrines/from-place/", payload);
}
