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

// 🔽 バックエンド直叩き用オリジン（公開御朱印フォールバック用だけ）
const BACKEND_ORIGIN = process.env.NEXT_PUBLIC_BACKEND_ORIGIN || "http://127.0.0.1:8000";

// エンドポイント候補（テスト用）
const PUBLIC_CANDIDATES = ["/goshuin/", "/goshuin/public/"] as const;
const MY_CANDIDATES = ["/my/goshuin/", "/goshuin/my/", "/me/goshuin/"] as const;

// 共通ヘルパー：配列 or {results: []} を吸収
function toList(data: any): Goshuin[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

// 絶対URLでバックエンドを叩くフォールバック（公開御朱印用）
async function fetchPublicFromBackend(): Promise<Goshuin[]> {
  const base = BACKEND_ORIGIN.replace(/\/+$/, "");
  const url = `${base}/api/goshuin/`;
  const r = await axios.get<any>(url, { withCredentials: true });
  return toList(r.data);
}

/**
 * 公開御朱印一覧（シンプル版：/goshuin/ を叩く）
 * テストで直接呼ばれている関数
 */
export async function fetchPublicGoshuin(): Promise<Goshuin[]> {
  const r = await api.get<any>("/goshuin/");
  return toList(r.data);
}

/**
 * 公開御朱印一覧（フォールバックロジック込み）
 */
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

      if (status === 401 || status === 403) {
        return [];
      }

      if (!err.response) {
        try {
          return await fetchPublicFromBackend();
        } catch {
          return [];
        }
      }

      if (status !== 404) {
        return [];
      }
    }
  }
  return [];
}

/**
 * 自分の御朱印一覧（互換用オート版）
 */
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
        return [];
      }

      if (status !== 404) {
        console.warn?.("[getMyGoshuinAuto] non-404 error", status);
        return [];
      }
    }
  }

  console.warn?.("[getMyGoshuinAuto] all candidates returned 404");
  return [];
}

// 互換エイリアス
export const getGoshuin = getGoshuinPublicAuto;
export const getGoshuinAuto = getGoshuinPublicAuto;

// ---- 実際に本番で使う GET 系 ----

// 公開御朱印一覧（シンプルラッパ）
export async function fetchGoshuin(): Promise<Goshuin[]> {
  return fetchPublicGoshuin();
}

// 自分の御朱印一覧（BFF /api/my/goshuin/ 経由）
export async function fetchMyGoshuin(): Promise<Goshuin[]> {
  const r = await api.get<any>("/my/goshuin/");
  return toList(r.data);
}

// ---- BFF 経由の POST / PATCH / DELETE ----

/**
 * 自分の御朱印をアップロード（BFF: POST /api/my/goshuin/）
 */
export async function uploadMyGoshuin(input: {
  shrineId: number;
  title: string;
  isPublic: boolean;
  file: File;
}): Promise<Goshuin> {
  const form = new FormData();
  form.append("shrine", String(input.shrineId));
  form.append("title", input.title);
  form.append("is_public", input.isPublic ? "true" : "false");
  form.append("image", input.file);

  // ここでは BACKEND_ORIGIN も token も使わない
  const r = await api.post<Goshuin>("/my/goshuin/", form);
  return r.data;
}

// 互換エイリアス（古いコード用）
export const uploadGoshuin = uploadMyGoshuin;

/**
 * 公開 / 非公開変更（BFF: PATCH /api/my/goshuin/:id/）
 */
export async function updateMyGoshuinVisibility(
  id: number,
  isPublic: boolean,
): Promise<Goshuin> {
  const r = await api.patch<Goshuin>(`/my/goshuin/${id}/`, {
    is_public: isPublic,
  });
  return r.data;
}

/**
 * 御朱印削除（BFF: DELETE /api/my/goshuin/:id/）
 */
export async function deleteMyGoshuin(id: number): Promise<void> {
  await api.delete(`/my/goshuin/${id}/`);
}
