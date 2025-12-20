// apps/web/src/app/login/LoginForm.tsx
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

type Props = { next?: string };

export default function LoginForm({ next = "/mypage?tab=goshuin" }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current || loading) return;

    inFlight.current = true;
    setLoading(true);
    setError(null);

    try {
      // 1) 未入力チェック（rawで）
      if (!username || !password) {
        setError("ユーザー名とパスワードを入力してください");
        return;
      }

      // 2) 前後スペース混入は弾く（raw vs trim 比較）
      if (username !== username.trim() || password !== password.trim()) {
        setError("ユーザー名/パスワードの前後に空白が入っています");
        return;
      }

      // 3) ここから先は raw をそのまま送る（trimしない）
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        let msg = "ログインに失敗しました。";
        try {
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const j = await res.json();
            msg = String(j.detail || j.message || j.error || msg);
          } else {
            const t = await res.text();
            if (t) msg = t;
          }
        } catch {}
        setError(msg);
        return;
      }

      router.push(next || "/mypage?tab=goshuin");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました。しばらくしてから再度お試しください。");
    } finally {
      setLoading(false);
      inFlight.current = false;
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
