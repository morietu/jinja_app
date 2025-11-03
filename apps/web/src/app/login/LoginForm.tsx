// apps/web/src/app/login/LoginForm.tsx
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import { login as loginApi } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/users";

type Props = { next?: string };

export default function LoginForm({ next = "/mypage?tab=goshuin" }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const router = useRouter();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current || loading) return;
    if (!username || !password) {
      setError("ユーザー名とパスワードを入力してください");
      return;
    }
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      // 1) ログイン
      await loginApi({ username, password });
      // 2) me で確認
      try {
        await getCurrentUser();
      } catch {
        /* noop */
      }
      // 3) 遷移
      router.replace(next);
    } catch (err: unknown) {
      let msg = "ログインに失敗しました。";
      if (isAxiosError(err)) {
        const s = err.response?.status ?? 0;
        if (s === 400) msg = "リクエストが正しくありません。";
        else if (s === 401)
          msg = "ユーザー名またはパスワードが正しくありません。";
        else if (s >= 500) msg = "サーバーエラーが発生しました。";
        else if (!err.response && err.request) {
          msg =
            "サーバーに接続できません。バックエンドの起動を確認してください。";
        }
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
      inFlight.current = false;
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

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">ユーザー名</label>
          <input
            className="border p-2 w-full rounded"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            autoComplete="username"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">パスワード</label>
          <input
            type="password"
            className="border p-2 w-full rounded"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "ログイン中..." : "ログイン"}
        </button>
      </form>
    </main>
  );
}
