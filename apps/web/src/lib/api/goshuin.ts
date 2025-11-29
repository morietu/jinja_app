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

// 🔽 バックエンド直叩き用オリジン
const BACKEND_ORIGIN = process.env.NEXT_PUBLIC_BACKEND_ORIGIN || "http://127.0.0.1:8000";

// エンドポイント候補（テストが想定している「複数候補」挙動）
const PUBLIC_CANDIDATES = ["/goshuin/", "/goshuin/public/"] as const;
const MY_CANDIDATES = ["/my/goshuin/", "/goshuin/my/", "/me/goshuin/"] as const;

// 共通ヘルパー：配列 or {results: []} を吸収
function toList(data: any): Goshuin[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

// 絶対URLでバックエンドを叩くフォールバック（テストで axios.get が1回呼ばれる想定）
async function fetchPublicFromBackend(): Promise<Goshuin[]> {
  const base = BACKEND_ORIGIN.replace(/\/+$/, "");
  const url = `${base}/api/goshuin/`;
  const r = await axios.get<any>(url, { withCredentials: true });
  return toList(r.data);
}

// 公開御朱印一覧（フォールバックロジック込み）
export async function getGoshuinPublicAuto(): Promise<Goshuin[]> {
  for (const path of PUBLIC_CANDIDATES) {
    try {
      const r = await api.get<any>(path);
      return toList(r.data);
    } catch (err: any) {
      if (!axios.isAxiosError(err)) {
        return [];
      }

      const status = err.response?.status;

      // 未ログインは即空配列
      if (status === 401 || status === 403) {
        return [];
      }

      // ネットワークエラー / CORS など：絶対URLフォールバックを1回だけ試す
      if (!err.response) {
        try {
          return await fetchPublicFromBackend();
        } catch {
          return [];
        }
      }

      // 404 は次の候補へ、それ以外は諦める
      if (status !== 404) {
        return [];
      }
      // ← 404 のときだけ loop 続行（→ api.get が候補数ぶん呼ばれる）
    }
  }

  return [];
}

// 自分の御朱印一覧（404 を候補ぶん試して全滅したら warn）
export async function getMyGoshuinAuto(): Promise<Goshuin[]> {
  for (const path of MY_CANDIDATES) {
    try {
      const r = await api.get<any>(path);
      return toList(r.data);
    } catch (err: any) {
      if (!axios.isAxiosError(err)) {
        console.warn?.("[getMyGoshuinAuto] unexpected error", err);
        return [];
      }

      const status = err.response?.status;

      if (status === 401 || status === 403) {
        // 未ログインは静かに空配列
        return [];
      }

      if (status !== 404) {
        console.warn?.("[getMyGoshuinAuto] non-404 error", status);
        return [];
      }

      // 404 → 次候補へ（何もしないでループ続行）
    }
  }

  console.warn?.("[getMyGoshuinAuto] all candidates returned 404");
  return [];
}

// 互換エイリアス
export const getGoshuin = getGoshuinPublicAuto;
export const getGoshuinAuto = getGoshuinPublicAuto;

export async function fetchPublicGoshuin(): Promise<Goshuin[]> {
  const r = await api.get<any>("/goshuin/");
  return toList(r.data);
}

export async function fetchMyGoshuin(): Promise<Goshuin[]> {
  const r = await api.get<any>("/my/goshuin/");
  const data = r.data;
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

export async function uploadMyGoshuin(formData: FormData): Promise<Goshuin> {
  const r = await api.post<Goshuin>("/my/goshuin/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return r.data;
}


// ★ 削除（バックエンド直叩き）
// ★ 削除：BFF 経由
export async function deleteMyGoshuin(id: number): Promise<void> {
  // baseURL = "/api"（ブラウザ時）なので
  // 実際のリクエストは DELETE /api/my/goshuin/:id/
  await api.delete(`/my/goshuin/${id}/`);
}

// ★ 公開/非公開更新：これも BFF 経由
export async function updateMyGoshuinVisibility(id: number, isPublic: boolean) {
  const r = await api.patch<Goshuin>(`/my/goshuin/${id}/`, { is_public: isPublic });
  return r.data;
}

