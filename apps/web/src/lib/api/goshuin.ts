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

// 🔽 バックエンド直叩き用オリジン（フォールバック用）
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

// 絶対URLでバックエンドを叩くフォールバック（テストが想定している挙動）
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
 * - PUBLIC_CANDIDATES を順に試す
 * - 404 のときだけ次候補へ
 * - 401/403 は即空配列
 * - レスポンスなしの AxiosError のときだけ BACKEND_ORIGIN 直叩き
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

/**
 * 自分の御朱印一覧（互換用オート版）
 * - MY_CANDIDATES を順に試す
 * - 401/403 は空配列
 * - 404 は次候補へ
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

// 互換エイリアス（テストで使われている）
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
  const data = r.data;
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
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

  const r = await api.post<Goshuin>("/my/goshuin/", form);
  return r.data;
}

// 互換エイリアス（古いコードが uploadGoshuin を呼んでも動くように）
export const uploadGoshuin = uploadMyGoshuin;

/**
 * 自分の御朱印削除（BFF: DELETE /api/my/goshuin/:id/）
 */
export async function deleteMyGoshuin(id: number): Promise<void> {
  await api.delete(`/my/goshuin/${id}/`);
}

/**
 * 公開 / 非公開変更（BFF: PATCH /api/my/goshuin/:id/）
 */
export async function updateMyGoshuinVisibility(id: number, isPublic: boolean): Promise<Goshuin> {
  const r = await api.patch<Goshuin>(`/my/goshuin/${id}/`, {
    is_public: isPublic,
  });
  return r.data;
}
