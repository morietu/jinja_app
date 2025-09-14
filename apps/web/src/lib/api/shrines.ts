import api from "./client";
import type { GoriyakuTag } from "./types";
import {
  toArray,
  pickPaginationMeta,
  type PaginationMeta,
} from "../utils/toArray";

// ★ Server Action の型と関数を唯一の正とする
import {
  createShrine as createShrineAction,
  type CreateShrineInput,
} from "@/app/shrines/actions";

export type { CreateShrineInput };

/** Shrine レコードの型（最小必須+任意項目） */
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

export type ShrineListParams = {
  q?: string;
  page?: number;
  page_size?: number;
};

/** 一覧取得 */
export async function listShrines(
  params: ShrineListParams = {}
): Promise<ShrineList> {
  const res = await api.get("/shrines/", { params });
  return {
    items: toArray<Shrine>(res.data),
    meta: pickPaginationMeta(res.data),
  };
}

/** 互換: 検索は一覧に集約 */
export const searchShrines = listShrines;

/** 互換: 配列だけ欲しい UI 向け */
export async function getShrines(
  params: { q?: string } = {}
): Promise<Shrine[]> {
  const { items } = await listShrines(params);
  return items;
}

/** 詳細取得（存在しなければ null） */
export async function getShrine(id: number): Promise<Shrine | null> {
  try {
    const res = await api.get(`/shrines/${id}/`);
    return res.data as Shrine;
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

/** 作成（★Server Action 経由・推奨） */
export async function createShrine(input: CreateShrineInput): Promise<Shrine> {
  // goriyakuTagIds: number[] を受け、Server Action 側で connect する
  return (await createShrineAction(input)) as unknown as Shrine;
}

/** 任意：REST で作成したい場合は別名で残す（バックエンドが対応している時のみ） */
export async function createShrineRest(input: CreateShrineInput): Promise<Shrine> {
  const res = await api.post("/shrines/", input);
  return res.data as Shrine;
}
