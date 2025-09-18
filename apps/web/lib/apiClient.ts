// --- 401 -> refresh 自動再試行（単一版）---
import axios from "axios";
// ※ setAuthToken は同ファイル内の export function のやつ（または import）を使用

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { response, config } = error || {};
    if (!response || !config) return Promise.reject(error);
    // SSR時は localStorage が無いので素通し
    if (typeof window === "undefined") return Promise.reject(error);

    // 401 かつ まだリトライしていないときだけ実行
    if (response.status !== 401 || (config as any).__isRetry) {
      return Promise.reject(error);
    }

    try {
      const refresh =
        localStorage.getItem("refresh") || localStorage.getItem("refresh_token");
      if (!refresh) throw new Error("no refresh token");

      // 別インスタンスで refresh（自分自身のインターセプタを踏まない）
      const r = await axios.post(
        "/api/token/refresh/",
        { refresh },
        { headers: { "Content-Type": "application/json" } }
      );
      const newAccess: string | undefined = r.data?.access;
      if (!newAccess) throw new Error("no access token");

      // 保存 & 以降のリクエストに付与
      localStorage.setItem("access", newAccess);
      setAuthToken(newAccess);

      // 同じリクエストを 1 回だけ再送
      (config as any).__isRetry = true;
      config.headers = config.headers ?? {};
      (config.headers as any).Authorization = `Bearer ${newAccess}`;
      return api(config);
    } catch {
      // 失敗 → トークン破棄（必要なら /login に遷移など）
      try {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
      } catch {}
      setAuthToken(null);
      return Promise.reject(error);
    }
  }
);
