"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";

type Props = { next?: string | null };

const DEFAULT_AFTER_LOGIN = "/";

export default function LoginForm({ next }: Props) {
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const afterLogin = next || DEFAULT_AFTER_LOGIN;
  const registerHref = `/auth/register?returnTo=${encodeURIComponent(afterLogin)}`;

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
      window.location.assign(afterLogin);
      return;
    } catch {
      setError("ログインに失敗しました。");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm p-4">
      <h1 className="mb-4 text-xl font-bold">ログイン</h1>

      {error && <div className="mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">ユーザー名</label>
          <input
            className="w-full rounded border p-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            autoComplete="username"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">パスワード</label>
          <input
            type="password"
            className="w-full rounded border p-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "ログイン中..." : "ログイン"}
        </button>
      </form>

      <div className="mt-4 text-sm text-slate-600">
        アカウントをお持ちでない方は{" "}
        <Link href={registerHref} className="font-semibold text-blue-600 hover:underline">
          新規登録はこちら
        </Link>
      </div>
    </main>
  );
}
