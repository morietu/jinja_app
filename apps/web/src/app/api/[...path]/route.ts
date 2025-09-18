// src/app/api/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs"; // Edge ではなく Node で動かす

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_ORIGIN || "http://127.0.0.1:8000";
const HOP_BY_HOP = [
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "upgrade", "content-length"
];

function stripHopByHop(h: Headers) {
  for (const k of HOP_BY_HOP) h.delete(k);
}

async function handler(req: NextRequest, ctx: { params: { path: string[] } }) {
  const target = `${BACKEND}/api/${ctx.params.path.join("/")}${req.nextUrl.search}`;

  // 元ヘッダをコピーしつつ危険ヘッダは除去
  const headers = new Headers(req.headers);
  stripHopByHop(headers);
  // host は fetch が自動で付けるので設定しない（環境により禁止/無視されることがある）
  // 代わりにフォワード系だけ付与
  const proto = req.nextUrl.protocol.replace(":", "");
  headers.set("x-forwarded-proto", proto);
  const host = req.headers.get("host");
  if (host) headers.set("x-forwarded-host", host);

  const init: RequestInit = {
    method: req.method,
    headers,
    // そのままストリーム転送（multipart 等でも安全）
    body: req.method === "GET" || req.method === "HEAD" ? undefined : (req as any).body,
    redirect: "follow", // Django の 301/302（末尾スラッシュ付与など）を追従
  };

  const res = await fetch(target, init);

  // 応答ヘッダも危険ヘッダを除去し、Set-Cookie を確実に複数転送
  const out = new Headers(res.headers);
  stripHopByHop(out);
  const setCookies = (res.headers as any).getSetCookie?.() ?? [];
  if (setCookies.length) {
    out.delete("set-cookie");
    for (const c of setCookies) out.append("set-cookie", c);
  }

  return new NextResponse(res.body, { status: res.status, headers: out });
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as OPTIONS,
};
