// apps/web/src/app/shrines/actions.ts
"use server";
import { apiGet, apiPost } from "@/lib/api/http";

export type CreateShrineInput = {
  name_jp: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  goriyaku: string;
  sajin: string;
  goriyakuTagIds: number[];
};

// 一覧
export async function getShrines() {
  return apiGet(`/shrines/`);
}

// 追加
export async function createShrine(input: CreateShrineInput) {
  const payload = {
    name_jp: input.name_jp,
    address: input.address ?? "",
    latitude: input.latitude,
    longitude: input.longitude,
    goriyaku: input.goriyaku ?? null,
    sajin: input.sajin ?? null,
    goriyaku_tags: input.goriyakuTagIds,
  };
  return apiPost(`/shrines/`, payload);
}
