// apps/web/src/lib/api/client.ts
import axios from "axios";

const api = axios.create({
  baseURL: "/api", // ★ここを固定
  withCredentials: true,
  headers: { Accept: "application/json" },
});

export default api;
