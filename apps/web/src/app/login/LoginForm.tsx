// apps/web/src/app/login/LoginForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AxiosError } from "axios";
import { login as loginApi } from "@/lib/api/auth";
import { useAuth } from "@/lib/hooks/useAuth";

export default function LoginForm({ next }: { next: string }) {
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
      // 1) 認証（トークン保存は loginApi 内で実施）
      await loginApi(username, password);

      // 2) me 同期（失敗は致命的でない）
      try {
        await login();
      } catch (e) {
        console.warn("ログイン後の /users/me 取得に失敗:", e);
      }

      // 3) 遷移
      router.replace(next);
    } catch (error: unknown) {
      const err = error as AxiosError;
      let msg = "ログインに失敗しました。";
      if (err?.response) {
        if (err.response.status === 401) msg = "ユーザー名またはパスワードが正しくありません。";
        else if (err.response.status === 400) msg = "リクエストが正しくありません。";
        else if ((err.response.status ?? 0) >= 500) msg = "サーバーエラーが発生しました。";
        else msg = `エラーが発生しました (${err.response.status})`;
      } else if (err?.request) {
        msg = "サーバーに接続できません。バックエンドの起動を確認してください。";
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
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
          <label className="block text-sm font-medium mb-1">ユーザー名</label>
          <input
            className="border p-2 w-full rounded"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">パスワード</label>
          <input
            type="password"
            className="border p-2 w-full rounded"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={loading}
          />
        </div>
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "ログイン中..." : "ログイン"}
        </button>
      </div>
    </main>
  );
}
