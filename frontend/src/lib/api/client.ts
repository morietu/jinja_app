import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api",
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// リクエストごとに Authorization ヘッダーを追加
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// レスポンスのインターセプター
api.interceptors.response.use(
  (response) => {
    console.log(
      `✅ API Response: ${response.status} ${response.config.url}`,
      response.data
    );
    return response;
  },
  (error) => {
    if (error.response) {
      console.error(`❌ API Error: ${error.config?.url}`, {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
      });
    } else if (error.request) {
      console.error(`⚠️ API No Response: ${error.config?.url}`, {
        request: error.request,
      });
    } else {
      console.error(`⚠️ API Setup Error: ${error.config?.url}`, {
        message: error.message,
      });
    }
    return Promise.reject(error);
  }
);

export default api;
