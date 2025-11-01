// apps/web/src/app/login/ClientLoginPage.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";

export default function ClientLoginPage({ next = "/mypage" }: { next?: string }) {
  const { login } = useAuth();
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const username = String(form.get("username") || "");
    const password = String(form.get("password") || "");
    try {
      const ok = await login(username, password); // /api/auth/login → Cookie設定 → /api/users/me/ 取得
      if (ok) router.replace(next);
      else setErr("ログインに失敗しました");
    } catch (e: any) {
      setErr(e?.message ?? "ログインに失敗しました");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">ログイン</h1>

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm text-gray-600">ユーザー名</label>
          <input
            name="username"
            className="w-full rounded border px-3 py-2"
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600">パスワード</label>
          <input
            type="password"
            name="password"
            className="w-full rounded border px-3 py-2"
            autoComplete="current-password"
            required
          />
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}

        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "送信中..." : "ログイン"}
        </button>
      </form>
    </main>
  );
}
