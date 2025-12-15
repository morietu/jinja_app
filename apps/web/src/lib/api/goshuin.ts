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

const BACKEND_ORIGIN = process.env.NEXT_PUBLIC_BACKEND_ORIGIN || "http://127.0.0.1:8000";

const PUBLIC_CANDIDATES = ["/goshuin/", "/goshuin/public/"] as const;
const MY_CANDIDATES = ["/my/goshuins/"] as const;


function toList(data: any): Goshuin[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

async function fetchPublicFromBackend(): Promise<Goshuin[]> {
  const base = BACKEND_ORIGIN.replace(/\/+$/, "");
  const url = `${base}/api/goshuins/`;
  const r = await axios.get<any>(url, { withCredentials: true });
  return toList(r.data);
}

export async function fetchPublicGoshuin(): Promise<Goshuin[]> {
  const r = await api.get<any>("/goshuins/");
  return toList(r.data);
}

export async function getGoshuinPublicAuto(): Promise<Goshuin[]> {
  for (const path of PUBLIC_CANDIDATES) {
    try {
      const r = await api.get<any>(path);
      return toList(r.data);
    } catch (err: any) {
      if (!axios.isAxiosError(err)) return [];
      const status = err.response?.status;

      if (status === 401 || status === 403) return [];
      if (!err.response) {
        try {
          return await fetchPublicFromBackend();
        } catch {
          return [];
        }
      }
      if (status !== 404) return [];
    }
  }
  return [];
}

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
      if (status === 401 || status === 403) return [];
      if (status !== 404) {
        console.warn?.("[getMyGoshuinAuto] non-404 error", status);
        return [];
      }
    }
  }
  console.warn?.("[getMyGoshuinAuto] all candidates returned 404");
  return [];
}

export const getGoshuin = getGoshuinPublicAuto;
export const getGoshuinAuto = getGoshuinPublicAuto;

export async function fetchGoshuin(): Promise<Goshuin[]> {
  return fetchPublicGoshuin();
}

// ✅ 自分の御朱印一覧（BFF /api/my/goshuin/ 経由）
export async function fetchMyGoshuin(): Promise<Goshuin[]> {
  const r = await api.get<any>("/my/goshuins/");
  return toList(r.data);
}

// ---- BFF 経由の POST / PATCH / DELETE ----

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

  const r = await api.post<Goshuin>("/my/goshuins/", form);
  return r.data;
}

export const uploadGoshuin = uploadMyGoshuin;

export async function updateMyGoshuinVisibility(id: number, isPublic: boolean): Promise<Goshuin> {
  const r = await api.patch<Goshuin>(`/my/goshuins/${id}/`, {
    is_public: isPublic,
  });
  return r.data;
}

export async function deleteMyGoshuin(id: number): Promise<void> {
  await api.delete(`/my/goshuins/${id}/`);
}
