// apps/web/src/lib/api/shrines.ts
import api from "./client";
import type { GoriyakuTag } from "./types";
import {
  toArray,
  pickPaginationMeta,
  type PaginationMeta,
} from "../utils/toArray";

import {
  createShrine as createShrineAction,
  type CreateShrineInput,
} from "@/app/shrines/actions";

// ★ これが今回必要な named export
// ★ 重複排除：取り込みは favorites に一本化
export { importFromPlace, type ImportResult } from "./favorites";



export type { CreateShrineInput };

export type Shrine = {
  id: number;
  name_jp: string;
  address: string;
  latitude: number;
  longitude: number;
  goriyaku?: string | null;
  sajin?: string | null;
  description?: string | null;
  goriyaku_tags: GoriyakuTag[];
  is_favorite?: boolean;
};

export type ShrineList = { items: Shrine[]; meta: PaginationMeta };
export type ShrineListParams = { q?: string; page?: number; page_size?: number };

export async function listShrines(params: ShrineListParams = {}): Promise<ShrineList> {
  const res = await api.get("/shrines/", { params });
  return { items: toArray<Shrine>(res.data), meta: pickPaginationMeta(res.data) };
}
export const searchShrines = listShrines;

export async function getShrines(params: { q?: string } = {}): Promise<Shrine[]> {
  const { items } = await listShrines(params);
  return items;
}

export async function getShrine(id: number): Promise<Shrine | null> {
  try {
    const res = await api.get(`/shrines/${id}/`);
    return res.data as Shrine;
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

export async function createShrine(input: CreateShrineInput): Promise<Shrine> {
  return (await createShrineAction(input)) as unknown as Shrine;
}

export async function createShrineRest(input: CreateShrineInput): Promise<Shrine> {
  const res = await api.post("/shrines/", input);
  return res.data as Shrine;
}
