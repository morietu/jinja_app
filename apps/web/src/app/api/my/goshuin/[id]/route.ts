// apps/web/src/app/api/my/goshuin/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { proxyMyGoshuinRequest } from "../route";

type RouteContext = {
  params?: { id?: string };
};

function buildPath(id: string): string {
  const safeId = encodeURIComponent(id);
  return `/api/my/goshuin/${safeId}/`;
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const id = ctx.params?.id;
  if (!id) {
    return NextResponse.json({ detail: "ID is required" }, { status: 400 });
  }
  return proxyMyGoshuinRequest(req, buildPath(id), "GET");
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const id = ctx.params?.id;
  if (!id) {
    return NextResponse.json({ detail: "ID is required" }, { status: 400 });
  }
  return proxyMyGoshuinRequest(req, buildPath(id), "PATCH");
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const id = ctx.params?.id;
  if (!id) {
    return NextResponse.json({ detail: "ID is required" }, { status: 400 });
  }
  return proxyMyGoshuinRequest(req, buildPath(id), "DELETE");
}

