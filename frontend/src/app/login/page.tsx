"use client";
import api from "@/lib/api/client";
import { useState } from "react";
import { login as loginApi } from "@/lib/api/auth";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { AxiosError } from "axios";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!username || !password) {
      setError("ユーザー名とパスワードを入力してください");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log("ログイン試行中...", { username });

      const response = await loginApi(username, password);
      console.log("ログインAPIレスポンス:", response);

      // 🎯 トークン保存（interceptor が拾えるように）
      localStorage.setItem("access_token", response.access);
      localStorage.setItem("refresh_token", response.refresh);

      // ログイン成功後、ユーザー情報を取得
      try {
        const userResponse = await api.get("/users/me/");
        const userData = userResponse.data;

        console.log("ユーザーデータ:", userData);
        login(userData);

        alert("ログイン成功！");
        router.push("/mypage");
      } catch (error: unknown) {
        const err = error as AxiosError;

        if (err.response) {
          console.error("APIエラーレスポンス:", err.response);
        } else if (err.request) {
          console.error("リクエストエラー:", err.request);
        } else {
          console.error("その他のエラー:", err instanceof Error ? err.message : err);
        }

        alert("ログイン成功！ユーザー情報の取得に失敗しました。");
        router.push("/mypage");
      }
    } catch (error: unknown) {
      // ログイン自体が失敗した場合
      console.error("ログインエラー詳細:", error);

      let errorMessage = "ログインに失敗しました。";
      const err = error as AxiosError;

      if (err.response) {
        console.error("APIエラーレスポンス:", err.response);
        if (err.response.status === 401) {
          errorMessage = "ユーザー名またはパスワードが正しくありません。";
        } else if (err.response.status === 400) {
          errorMessage = "リクエストが正しくありません。";
        } else if (err.response.status === 500) {
          errorMessage = "サーバーエラーが発生しました。";
        } else {
          errorMessage = `エラーが発生しました (${err.response.status})`;
        }
      } else if (err.request) {
        console.error("リクエストエラー:", err.request);
        errorMessage = "サーバーに接続できません。バックエンドが起動しているか確認してください。";
      } else {
        errorMessage = err instanceof Error ? err.message : "予期しないエラーが発生しました。";
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  return (
    <main className="p-4 max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4">ログイン</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
            ユーザー名
          </label>
          <input
            id="username"
            type="text"
            placeholder="ユーザー名を入力"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyPress={handleKeyPress}
            className="border border-gray-300 p-2 w-full rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            パスワード
          </label>
          <input
            id="password"
            type="password"
            placeholder="パスワードを入力"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={handleKeyPress}
            className="border border-gray-300 p-2 w-full rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "ログイン中..." : "ログイン"}
        </button>
      </div>

      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600">
          アカウントをお持ちでない方は
          <button
            onClick={() => router.push("/register")}
            className="text-blue-600 hover:underline ml-1"
          >
            新規登録
          </button>
        </p>
      </div>
    </main>
  );
}
