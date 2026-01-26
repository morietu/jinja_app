import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "not implemented", detail: "public goshuins by username is not supported yet" },
    { status: 501 },
  );
}
