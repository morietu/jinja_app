"use client";
import { useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRouter } from "next/navigation";

export default function ClientLoginPage({ next }: { next: string }) {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();                 // ← これが無いとブラウザがURL-encodedで直送しがち
    setErr(null);
    setPending(true);
    try {
      await login({ username, password }); // /api/auth/login に JSON で投げる
      router.replace(next || "/mypage");
    } catch (e: any) {
      setErr(e?.message ?? "ログインに失敗しました");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">ログイン</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm text-gray-600">ユーザー名</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            name="username"
            autoComplete="username"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600">パスワード</label>
          <input
            className="w-full border rounded px-3 py-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            name="password"
            autoComplete="current-password"
          />
        </div>
        {err && <p className="text-red-600 text-sm">{err}</p>}
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
        >
          {pending ? "送信中..." : "ログイン"}
        </button>
      </form>
    </main>
  );
}
