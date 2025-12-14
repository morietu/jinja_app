// apps/web/src/app/api/my/goshuin/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { djFetch } from "@/lib/server/backend";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// -------------------- GET --------------------
export async function GET(req: NextRequest) {
  return proxyMyGoshuinRequest(req, "/api/my/goshuin/", "GET");
}

// -------------------- POST (upload) --------------------
export async function POST(req: NextRequest) {
  return proxyMyGoshuinRequest(req, "/api/my/goshuin/", "POST");
}

// -------------------- PATCH / DELETE 用 --------------------
export async function PATCH(req: NextRequest) {
  return proxyMyGoshuinRequest(req, "/api/my/goshuin/", "PATCH");
}

export async function DELETE(req: NextRequest) {
  return proxyMyGoshuinRequest(req, "/api/my/goshuin/", "DELETE");
}

// -------------------- 共通プロキシ --------------------
export async function proxyMyGoshuinRequest(req: NextRequest, basePath: string, method: string) {
  try {
    // forward cookies -> Authorization header if present
    const store = await cookies();
    const access = store.get("access_token")?.value ?? null;

    const headers: Record<string, string> = { Accept: "application/json" };
    if (access) headers["Authorization"] = `Bearer ${access}`;

    const ct = req.headers.get("content-type");
    const isMultipart = ct?.includes("multipart/form-data") ?? false;

    // body を一度だけ読み取る（FormData は一度しか読み取れないため）
    let body: FormData | string | undefined;
    if (method !== "GET") {
      if (isMultipart) {
        // multipart/form-data の場合は FormData として処理。
        // そのまま渡すと境界線が噛み合わないケースがあったので、念のため詰め替える。
        const incoming = await req.formData();
        const outgoing = new FormData();
        incoming.forEach((value, key) => {
          outgoing.append(key, value as any);
        });
        body = outgoing;
        // Content-Type ヘッダーは FormData を送信する際に自動設定されるため削除
      } else {
        // JSON やその他の場合は text として転送
        body = await req.text();
        if (ct) headers["Content-Type"] = ct;
      }
    }

    const search = req.nextUrl?.search || "";
    const target = `${basePath}${search}`;

    const init: RequestInit = { method, headers, body };

    let r = await djFetch(target, init);
    let text = await r.text();

    // If unauthorized, try refresh (once) when refresh token exists
    if (r.status === 401) {
      const refresh = store.get("refresh_token")?.value ?? null;
      if (refresh) {
        try {
          const rr = await djFetch(`/api/auth/jwt/refresh/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh }),
          });
          if (rr.ok) {
            const j = await rr.json();
            const newAccess = j.access;
            // retry original request with new access
            headers["Authorization"] = `Bearer ${newAccess}`;
            r = await djFetch(target, { method, headers, body });
            text = await r.text();

            if (r.ok) {
              // set new access token cookie in response
              const json = JSON.parse(text || "null");
              const res = NextResponse.json(json, { status: r.status });
              res.cookies.set("access_token", newAccess, {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                maxAge: 60 * 60,
                secure: false,
              });
              return res;
            }
          }
        } catch (e) {
          console.warn("refresh attempt failed", e);
        }
      }
    }

    if (!r.ok) {
      try {
        const errJson = JSON.parse(text);
        return NextResponse.json(errJson, { status: r.status });
      } catch {
        return new NextResponse(text || "Failed", { status: r.status });
      }
    }

    if (!text) {
      return new NextResponse(null, { status: r.status });
    }

    return NextResponse.json(JSON.parse(text), { status: r.status });
  } catch (err) {
    console.warn("proxyRequest failed", err);
    return NextResponse.json({ detail: "バックエンドに接続できません" }, { status: 503 });
  }
}
