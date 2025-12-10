// apps/web/src/app/api/my/goshuins/route.ts
import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export const dynamic = "force-dynamic";

// GET /api/my/goshuins/ → Django /api/my/goshuins/
export async function GET(req: NextRequest) {
  const upstream = await djFetch(req, "/api/my/goshuins/", {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const body = await upstream.text();

  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
    },
  });
}

// POST /api/my/goshuins/ → Django /api/my/goshuins/
export async function POST(req: NextRequest) {
  const incoming = await req.formData();
  const outgoing = new FormData();
  incoming.forEach((value, key) => {
    outgoing.append(key, value as any);
  });

  const upstream = await djFetch(req, "/api/my/goshuins/", {
    method: "POST",
    body: outgoing,
    headers: {
      Accept: "application/json",
    },
  });

  const body = await upstream.text();

  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
    },
  });
}
