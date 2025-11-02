"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api/auth";

export default function ClientLoginPage({ next }: { next: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const username = String(fd.get("username") || "");
    const password = String(fd.get("password") || "");
    try {
      await login({ username, password });
      router.replace(next || "/mypage");
    } catch (e: any) {
      setErr(e?.message ?? "ログインに失敗しました。ユーザー名/パスワードをご確認ください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">ログイン</h1>

      {err && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
          {err}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm text-gray-600 mb-1">ユーザー名</label>
          <input
            id="username"
            name="username"
            required
            className="w-full rounded border px-3 py-2"
            autoComplete="username"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm text-gray-600 mb-1">パスワード</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="w-full rounded border px-3 py-2"
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full rounded px-4 py-2 text-white ${loading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"}`}
        >
          {loading ? "送信中…" : "ログイン"}
        </button>
      </form>
    </main>
  );
}
