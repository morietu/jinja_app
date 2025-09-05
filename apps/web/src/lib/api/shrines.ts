import api from "./client";
import type { GoriyakuTag } from "./types";
import {
  toArray,
  pickPaginationMeta,
  type PaginationMeta,
} from "../utils/toArray";

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
  /** API都合で乗る場合がある。なければ undefined のまま */
  is_favorite?: boolean;
};

export type ShrineList = { items: Shrine[]; meta: PaginationMeta };

export type ShrineListParams = {
  /** フリーワード検索（バックエンド側 q 対応を想定） */
  q?: string;
  /** DRF ページネーションを想定（あるなら） */
  page?: number;
  page_size?: number;
};

/**
 * 一覧取得（正規API）
 * - 常に配列で返す（items）
 * - ページネーション情報は meta に分離
 * - axios の baseURL は http://localhost:8000/api を想定
 */
export async function listShrines(
  params: ShrineListParams = {}
): Promise<ShrineList> {
  const res = await api.get("/shrines/", { params });
  return {
    items: toArray<Shrine>(res.data),
    meta: pickPaginationMeta(res.data),
  };
}

/** 互換: 旧 searchShrines を listShrines へ集約（UIの呼び出しを壊さない） */
export const searchShrines = listShrines;

/** 互換: 配列だけ欲しい既存UI向けの薄いラッパ（MVP期間中は残す） */
export async function getShrines(
  params: { q?: string } = {}
): Promise<Shrine[]> {
  const { items } = await listShrines(params);
  return items;
}

/** 詳細取得（存在しなければ null 返却で UI を壊さない） */
export async function getShrine(id: number): Promise<Shrine | null> {
  try {
    const res = await api.get(`/shrines/${id}/`);
    return res.data as Shrine;
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

/** 作成（必要なフィールドはMVP想定の最小） */
export type CreateShrineInput = {
  name_jp: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  goriyaku?: string | null;
  sajin?: string | null;
  description?: string | null;
  goriyaku_tags?: GoriyakuTag[]; // バックエンドが受ければ
};

export async function createShrine(data: CreateShrineInput): Promise<Shrine> {
  const res = await api.post("/shrines/", data);
  return res.data as Shrine;
}
