"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { sanitizeNext } from "@/lib/nav/login";

type Props = { next?: string | null };

const DEFAULT_AFTER_LOGIN = "/";

export default function LoginForm({ next }: Props) {
  const { login } = useAuth();
  const safeNext = sanitizeNext(next) ?? DEFAULT_AFTER_LOGIN;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current || loading) return;

    inFlight.current = true;
    setLoading(true);
    setError(null);

    try {
      if (!username || !password) {
        setError("ユーザー名とパスワードを入力してください");
        return;
      }
      if (username !== username.trim() || password !== password.trim()) {
        setError("ユーザー名/パスワードの前後に空白が入っています");
        return;
      }

      await login(username, password);
      window.location.assign(safeNext);
      return;
    } catch {
      setError("ログインに失敗しました。");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }

  return (
    <main className="p-4 max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4">ログイン</h1>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
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
