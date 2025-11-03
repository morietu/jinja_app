// apps/web/src/lib/api/client.ts
import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api",
  withCredentials: true,
});

api.interceptors.request.use((cfg) => {
  cfg.headers = cfg.headers ?? ({} as any);
  // もし Bearer を入れたいならここで tokens.access を付与する
  // const t = tokens.access();
  // if (t) (cfg.headers as any).Authorization = `Bearer ${t}`;
  return cfg;
});

export default api;
