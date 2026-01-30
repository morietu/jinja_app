// apps/web/src/lib/api/goshuin.ts
import api from "./client";
import { fetchOnce, invalidateOnce } from "@/lib/api/inflight";
import type { Goshuin as GoshuinType } from "./types";

export type { Goshuin } from "./types";

export type GoshuinCount = { count: number; limit: number; remaining: number; can_add: boolean };

function toList(data: any): GoshuinType[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

// Public（正規）
export async function fetchPublicGoshuin(): Promise<GoshuinType[]> {
  const r = await api.get<any>("/goshuins/");
  return toList(r.data);
}

// My（正規）
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

// 互換エイリアス（必要なら残すが、中身は正規に）
export const getGoshuin = fetchPublicGoshuin;
export const getGoshuinAuto = fetchPublicGoshuin;
export const fetchGoshuin = fetchPublicGoshuin;

// ---- POST/PATCH/DELETE（現状のまま） ----
export async function uploadMyGoshuin(input: {
  shrineId?: number;
  title: string;
  isPublic: boolean;
  file: File;
}): Promise<GoshuinType> {
  invalidateOnce("GET:/api/my/goshuins/");
  invalidateOnce("GET:/api/my/goshuins/count/");

  const form = new FormData();
  if (input.shrineId != null) form.append("shrine", String(input.shrineId));
  form.append("title", input.title);
  form.append("is_public", input.isPublic ? "true" : "false");
  form.append("image", input.file);

  const r = await api.post<GoshuinType>("/my/goshuins/", form);

  invalidateOnce("GET:/api/my/goshuins/");
  invalidateOnce("GET:/api/my/goshuins/count/");

  return r.data;
}

export const uploadGoshuin = uploadMyGoshuin;

export async function updateMyGoshuinVisibility(id: number, isPublic: boolean): Promise<GoshuinType> {
  const r = await api.patch<GoshuinType>(`/my/goshuins/${id}/`, { is_public: isPublic });
  return r.data;
}

export async function deleteMyGoshuin(id: number): Promise<void> {
  await api.delete(`/my/goshuins/${id}/`);
}
