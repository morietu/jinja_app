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

function normalize(p: string) {
  let s = (p || "").trim();
  if (!s.startsWith("/")) s = "/" + s;
  if (!s.endsWith("/")) s += "/";
  return s;
}

// フォールバックは同一オリジンの絶対URLに限定
const PUBLIC_BASE = typeof window !== "undefined" ? window.location.origin : "";

const CANDIDATES = ["/goshuin", "/users/me/goshuin", "/temples/goshuin"].map(normalize);

export async function getGoshuinPublicAuto(): Promise<Goshuin[]> {
  for (const p of CANDIDATES) {
    try {
      const r = await api.get<Goshuin[]>(p); // /api 経由（相対）
      return r.data ?? [];
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response?.status === 404) continue;
      if (axios.isAxiosError(err) && !err.response && PUBLIC_BASE) {
        try {
          const abs = `${PUBLIC_BASE}/api${p}`; // 絶対URLへ
          const r2 = await axios.get<Goshuin[]>(abs);
          return r2.data ?? [];
        } catch { /* ignore and try next */ }
      }
      if (axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403)) {
        return [];
      }
    }
  }
  console.warn("[goshuin] public endpoint not found; returning empty list");
  return [];
}

export async function getMyGoshuinAuto(): Promise<Goshuin[]> {
  for (const p of CANDIDATES) {
    try {
      const r = await api.get<Goshuin[]>(p);
      return r.data ?? [];
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response?.status === 404) continue;
      if (axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403)) return [];
      if (axios.isAxiosError(err) && !err.response) return [];
      return [];
    }
  }
  console.warn("[goshuin] my endpoint not found; returning empty list");
  return [];
}

export async function fetchPublicGoshuin(): Promise<Goshuin[]> {
  const r = await api.get<Goshuin[]>("/goshuin/");
  return r.data ?? [];
}
export async function fetchMyGoshuin(): Promise<Goshuin[]> {
  const r = await api.get<Goshuin[]>("/my/goshuin/");
  return r.data ?? [];
}

export const getGoshuin = getGoshuinPublicAuto;
export const getGoshuinAuto = getGoshuinPublicAuto;
