"use server";
import type { Shrine } from "@/lib/api/types";
import { ApiError } from "@/lib/api/ApiError";

// 一覧
export async function getShrines(): Promise<Shrine[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/shrines/`, {
    cache: "no-store",
  });
  if (!res.ok) throw new ApiError("API error", res.status);
  return res.json();
}

// 追加

export type CreateShrineInput = {
  name_jp: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  goriyaku?: string | null;
  sajin?: string | null;
  goriyakuTagIds: number[];
  kind?: "shrine" | "temple";
};

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

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/shrines/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError(body?.detail ?? "API error", res.status, body);
  }
  return body as Shrine;
}
