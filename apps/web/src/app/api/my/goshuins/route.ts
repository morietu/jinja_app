// apps/web/src/app/api/my/goshuins/route.ts
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import sharp from "sharp";
import { getDjangoOrigin } from "@/lib/server/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function apiBaseUrl() {
  return getDjangoOrigin();
}

async function getAccessTokenFromCookie() {
  const c = await cookies();
  return c.get("access_token")?.value ?? null;
}

async function proxyUpstream(path: string, init: RequestInit) {
  const r = await fetch(`${apiBaseUrl()}${path}`, init);
  const text = await r.text();

  // 成功時は静かに、失敗時だけ情報を出す
  console.log("Django status:", r.status);
  if (!r.ok) console.log("Django body:", text);

  return new Response(text, {
    status: r.status,
    headers: { "content-type": r.headers.get("content-type") ?? "application/json" },
  });
}

export async function GET() {
  const token = await getAccessTokenFromCookie();
  if (!token) return Response.json({ detail: "missing access_token cookie" }, { status: 401 });

  return proxyUpstream("/api/my/goshuins/", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function POST(req: NextRequest) {
  const token = await getAccessTokenFromCookie();
  if (!token) return Response.json({ detail: "missing access_token cookie" }, { status: 401 });

  const fd = await req.formData();
  const img = fd.get("image");

  console.log("[BFF] inbound image:", img instanceof File, (img as any)?.type, (img as any)?.name, (img as any)?.size);

  if (!(img instanceof File)) {
    return Response.json({ image: ["missing image"] }, { status: 400 });
  }

  // 画像以外をコピー
  const out = new FormData();
  for (const [k, v] of fd.entries()) {
    if (k === "image") continue;
    out.append(k, typeof v === "string" ? v : String(v));
  }

  // MPO/HEIC混入でもJPEG化。失敗したら400にする
  let jpegBuf: Buffer;
  try {
    const buf = Buffer.from(await img.arrayBuffer());
    jpegBuf = await sharp(buf).jpeg({ quality: 90 }).toBuffer();
  } catch (e) {
    console.log("[BFF] sharp convert failed:", String(e));
    return Response.json({ image: ["invalid or unsupported image"] }, { status: 400 });
  }

  out.append("image", new Blob([new Uint8Array(jpegBuf)], { type: "image/jpeg" }), "upload.jpg");
  console.log("[BFF] outbound image:", "image/jpeg", "upload.jpg", jpegBuf.length);

  return proxyUpstream("/api/my/goshuins/", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    // Content-Type は絶対に付けない（boundaryが死ぬ）
    body: out,
  });
}
