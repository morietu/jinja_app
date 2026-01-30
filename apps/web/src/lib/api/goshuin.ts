// apps/web/src/lib/api/goshuin.ts
import axios from "axios";
import api from "./client";
import { devLog } from "@/lib/client/logging";
import { fetchOnce, invalidateOnce } from "@/lib/api/inflight";

export type { Goshuin } from "./types";
import type { Goshuin as GoshuinType } from "./types";



export type GoshuinCount = { count: number; limit: number; remaining: number; can_add: boolean };



const PUBLIC_CANDIDATES = ["/goshuins/", "/goshuin/", "/goshuin/public/"] as const;
const MY_CANDIDATES = ["/my/goshuins/"] as const;

function toList(data: any): GoshuinType[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}



export async function fetchPublicGoshuin(): Promise<GoshuinType[]> {
  const r = await api.get<any>("/goshuins/");
  return toList(r.data);
}


export async function getGoshuinPublicAuto(): Promise<GoshuinType[]> {
  for (const path of PUBLIC_CANDIDATES) {
    try {
      const r = await api.get<any>(path);
      return toList(r.data);
    } catch (err: any) {
      if (!axios.isAxiosError(err)) return [];

      const status = err.response?.status;

      // 認証エラーは「見せない」でOK
      if (status === 401 || status === 403) return [];

      // ネットワークエラー等（err.response が無い）も直叩きしない
      if (!err.response) return [];

      // 404 は候補を次へ。それ以外はログだけ出して終了
      if (status !== 404) {
        devLog("getGoshuinPublicAuto:NON_404_ERROR", { status });
        return [];
      }
    }
  }
  return [];
}

export async function getMyGoshuinAuto(): Promise<GoshuinType[]> {
  for (const path of MY_CANDIDATES) {
    try {
      const r = await api.get<any>(path);
      return toList(r.data);
    } catch (err: any) {
      if (!axios.isAxiosError(err)) {
        devLog("getMyGoshuinAuto:UNEXPECTED_ERROR", {
          message: err instanceof Error ? err.message : String(err),
        });
        return [];
      }

      const status = err.response?.status;
      if (status === 401 || status === 403) return [];
      if (status !== 404) {
        devLog("getMyGoshuinAuto:NON_404_ERROR", { status });
        return [];
      }
    }
  }

  devLog("getMyGoshuinAuto:ALL_404", {});
  return [];
}

export const getGoshuin = getGoshuinPublicAuto;
export const getGoshuinAuto = getGoshuinPublicAuto;

export async function fetchGoshuin(): Promise<GoshuinType[]> {
  return fetchPublicGoshuin();
}

// ✅ 自分の御朱印一覧（BFF /api/my/goshuins/ 経由）
export async function fetchMyGoshuin(): Promise<GoshuinType[]> {
  return fetchOnce("GET:/api/my/goshuins/", async () => {
    const r = await api.get<any>("/my/goshuins/");
    return toList(r.data);
  });
}

export async function fetchMyGoshuinCount(): Promise<GoshuinCount> {
  return fetchOnce("GET:/api/my/goshuins/count/", async () => {
    const r = await api.get<GoshuinCount>("/my/goshuins/count/");
    return r.data;
  });
}

// ---- BFF 経由の POST / PATCH / DELETE ----

export async function uploadMyGoshuin(input: {
  shrineId?: number;
  title: string;
  isPublic: boolean;
  file: File;
}): Promise<GoshuinType> {
  // ✅ これから変わるので、先に無効化（保険）
  invalidateOnce("GET:/api/my/goshuins/");
  invalidateOnce("GET:/api/my/goshuins/count/");

  const form = new FormData();
  if (input.shrineId != null) form.append("shrine", String(input.shrineId));
  form.append("title", input.title);
  form.append("is_public", input.isPublic ? "true" : "false");
  form.append("image", input.file);

  const r = await api.post<GoshuinType>("/my/goshuins/", form);

  // ✅ 念のためもう一回無効化（UIが直後に読むなら効く）
  invalidateOnce("GET:/api/my/goshuins/");
  invalidateOnce("GET:/api/my/goshuins/count/");

  return r.data;
}

export const uploadGoshuin = uploadMyGoshuin;

export async function updateMyGoshuinVisibility(id: number, isPublic: boolean): Promise<GoshuinType> {
  const r = await api.patch<GoshuinType>(`/my/goshuins/${id}/`, {
    is_public: isPublic,
  });
  return r.data;
}

export async function deleteMyGoshuin(id: number): Promise<void> {
  await api.delete(`/my/goshuins/${id}/`);
}
