import axios from "axios";
const base = (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "") || "/api");
export const api = axios.create({
  baseURL: base,
  withCredentials: true,
  timeout: 15000,
  headers: { "X-Requested-With": "XMLHttpRequest" },
});
export default api;
