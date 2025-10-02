// apps/web/src/lib/axios.ts
import axios from "axios";
export const api = axios.create({ baseURL: "/api", withCredentials: true });

let refreshing = false;
export function install401Retry() {
  api.interceptors.response.use(
    (res) => res,
    async (error) => {
      const cfg = error?.config ?? {};
      if (error?.response?.status === 401 && !cfg.__retried) {
        if (!refreshing) {
          refreshing = true;
          await fetch("/api/auth/refresh", { method: "POST" }).finally(() => (refreshing = false));
        }
        cfg.__retried = true;
        return api(cfg);
      }
      return Promise.reject(error);
    }
  );
}
