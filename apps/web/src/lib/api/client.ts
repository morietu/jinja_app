// apps/web/src/lib/api/client.ts
import axios from "axios";
import { getCookie } from "./authTokens";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

// CSRF だけ付与（GET/HEAD/OPTIONS 以外）
api.interceptors.request.use((config) => {
  const method = (config.method || "get").toLowerCase();
  if (!["get", "head", "options"].includes(method)) {
    const token = getCookie("csrftoken");
    if (token) {
      config.headers = config.headers ?? {};
      (config.headers as any)["X-CSRFToken"] = token;
    }
  }
  return config;
});

export default api;
