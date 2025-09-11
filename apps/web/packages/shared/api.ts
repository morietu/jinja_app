import axios, { AxiosInstance } from "axios";
import type { TokenStore } from "./tokenStore";

export function createApi(baseURL: string, tokens: TokenStore): AxiosInstance {
  const api = axios.create({ baseURL });
  api.interceptors.request.use(async (config) => {
    const t = await tokens.get();
    if (t) config.headers.Authorization = `Bearer ${t}`;
    return config;
  });
  return api;
}
