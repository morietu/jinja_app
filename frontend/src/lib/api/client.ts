import axios from "axios";

const isServer = typeof window === "undefined";

const api = axios.create({
  baseURL: isServer
    ? process.env.NEXT_PUBLIC_API_BASE_SERVER || "http://web:8000/api"
    : process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api",
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

console.log("DEBUG baseURL =", api.defaults.baseURL);

// -------------------------
// リクエストインターセプター
// -------------------------
api.interceptors.request.use((config) => {
  console.log("➡️ API Request:", `${config.baseURL}${config.url}`);

  // 認証不要のエンドポイントは除外
  if (
    config.url?.startsWith("/shrines") ||
    config.url?.startsWith("/goriyaku-tags") ||
    config.url?.startsWith("/ranking") ||
    config.url === "/concierge"
  ) {
    return config;
  }

  // 認証必要なら Authorization を付与
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// -------------------------
// レスポンスインターセプター
// -------------------------
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // エラーログ
    console.error("❌ API Error:", error);

    // 401 の場合は refresh を試す
    if (error.response?.status === 401) {
      const originalRequest = error.config;
      if (!originalRequest) return Promise.reject(error);

      if (originalRequest._retry) {
        console.warn("⏩ refresh 試行済み → 再ログインへ");
        return Promise.reject(error);
      }
      originalRequest._retry = true;

      try {
        const refresh = localStorage.getItem("refresh_token");
        console.warn("🔄 401発生 → refresh token で再発行を試みます");
        if (!refresh) throw new Error("No refresh token");

        const res = await axios.post(
          `${process.env.NEXT_PUBLIC_API_BASE}/token/refresh/`,
          { refresh }
        );
        console.log("✅ refresh 成功", res.data);

        const newAccess = res.data.access;
        localStorage.setItem("access_token", newAccess);

        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest); // 再リクエスト
      } catch (err) {
        console.error("リフレッシュ失敗", err);
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default api;
