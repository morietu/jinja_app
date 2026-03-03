"use server";

import { ApiError } from "@/lib/api/ApiError";
import type { Shrine } from "@/lib/api/shrines";
import { headers } from "next/headers";

// 一覧（public）
export async function getShrines(): Promise<Shrine[]> {
  const res = await fetch("/api/shrines/", { cache: "no-store" });
  if (!res.ok) throw new ApiError("API error", res.status);
  return res.json();
}

export async function createShrine(input: {
  name_jp: string;
  address: string;
  latitude?: number;
  longitude?: number;
  goriyaku?: string;
  sajin?: string;
  goriyakuTagIds?: number[];
}) {
  const payload = {
    ...input,
    goriyaku_tag_ids: input.goriyakuTagIds ?? [],
  };

  // cookie を明示で forward（BFF側で token 化するなら重要）
  const h = await headers();
  const cookie = h.get("cookie") ?? "";

  const res = await fetch("/api/my/shrines/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) throw new ApiError(body?.detail ?? "API error", res.status, body);
  return body as Shrine;
}
