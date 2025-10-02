// apps/web/src/lib/api/goshuin.ts
import axios from "axios";
import api from "./client";

export type Goshuin = {
  id: number;
  shrine: number;
  title?: string | null;
  image_url?: string | null;
  created_at?: string;
  is_public: boolean;
  shrine_name?: string;
};

// 共通ユーティリティ
function normalize(p: string) {
  let s = (p || "").trim();
  if (!s.startsWith("/")) s = "/" + s;
  if (!s.endsWith("/")) s += "/";
  return s;
}

// 絶対URLの基底（公開APIフォールバック用に限定して使用）
const PUBLIC_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000").replace(/\/$/, "");

// 最有力候補から順に探す（環境で違っても耐える）
const CANDIDATES = ["/goshuin", "/users/me/goshuin", "/temples/goshuin"].map(normalize);

/** 公開一覧（認証不要・/api経由。ネットワーク断のときだけ絶対URLにフォールバック可） */
export async function getGoshuinPublicAuto(): Promise<Goshuin[]> {
  for (const p of CANDIDATES) {
    try {
      const r = await api.get<Goshuin[]>(p); // /api 経由（相対）
      return r.data ?? [];
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response?.status === 404) continue;
      // 公開APIに限り、レスポンス自体が無い（ネットワーク断など）の場合のみフォールバック
      if (axios.isAxiosError(err) && !err.response) {
        try {
          const abs = `${PUBLIC_BASE}/api${p}`;
          const r2 = await axios.get<Goshuin[]>(abs);
          return r2.data ?? [];
        } catch { /* ignore and try next */ }
      }
      if (axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403)) {
        // 公開APIで本来起きないが、来た場合は空で継続
        return [];
      }
    }
  }
  console.warn("[goshuin] public endpoint not found; returning empty list");
  return [];
}

/** 自分の一覧（要認証）→ 絶対URLフォールバックはしない */
export async function getMyGoshuinAuto(): Promise<Goshuin[]> {
  for (const p of CANDIDATES) {
    try {
      const r = await api.get<Goshuin[]>(p); // /api 経由（Cookie送信）
      return r.data ?? [];
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response?.status === 404) continue;
      if (axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403)) return [];
      if (axios.isAxiosError(err) && !err.response) return []; // ネットワーク断でもフォールバックしない
      return [];
    }
  }
  console.warn("[goshuin] my endpoint not found; returning empty list");
  return [];
}

// 既存のシンプルAPI（保持するならそのまま）
export async function fetchPublicGoshuin(): Promise<Goshuin[]> {
  const r = await api.get<Goshuin[]>("/goshuin/");
  return r.data ?? [];
}
export async function fetchMyGoshuin(): Promise<Goshuin[]> {
  const r = await api.get<Goshuin[]>("/my/goshuin/");
  return r.data ?? [];
}

// 既存呼び出し互換：用途に応じて片方へ寄せる
export const getGoshuin = getGoshuinPublicAuto;
export const getGoshuinAuto = getGoshuinPublicAuto;
