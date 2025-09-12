import axios from "axios";

// SSRかどうか
const isServer = typeof window === "undefined";

// SSRでは API_BASE_SERVER を優先、CSRでは NEXT_PUBLIC_API_BASE を使う
const BASE =
  (isServer ? process.env.API_BASE_SERVER : process.env.NEXT_PUBLIC_API_BASE) ||
  "http://localhost:8000";

export const api = axios.create({ baseURL: BASE });

/** 認証ヘッダの付け外し（ログイン後に呼ぶ） */
export function setAuthToken(token: string | null) {
  if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete api.defaults.headers.common["Authorization"];
}

export const API = process.env.NEXT_PUBLIC_API_BASE!;

export async function getPopular(limit=6) {
  const r = await fetch(`${API}/api/shrines/popular/?limit=${limit}`, { cache: "no-store" });
  return r.json();
}

export async function findPlace(params: { input: string; language?: string; locationbias?: string; fields?: string; }) {
  const usp = new URLSearchParams({
    input: params.input,
    language: params.language ?? "ja",
    locationbias: params.locationbias ?? "",
    fields: params.fields ?? "place_id,name,geometry,formatted_address,photos,rating,user_ratings_total",
  });
  const r = await fetch(`${API}/api/places/find_place/?${usp.toString()}`, { cache: "no-store" });
  return r.json();
}