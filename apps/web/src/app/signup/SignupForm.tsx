// apps/web/src/app/signup/SignupForm.tsx
"use client";

import { useRef, useState } from "react";
import type { AxiosError } from "axios";
import { signup, login as loginApi } from "@/lib/api/auth";

type Props = {
  returnTo?: string | null;
};

export default function SignupForm({ returnTo }: Props) {
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [email, setE] = useState("");
  const [loading, setL] = useState(false);
  const [error, setErr] = useState<string | null>(null);
  const inFlight = useRef(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current || loading) return;

    if (!username || password.length < 8) {
      setErr("ユーザー名と8文字以上のパスワードを入力してください");
      return;
    }

    setErr(null);
    setL(true);
    inFlight.current = true;

    try {
      await signup({ username, password, email: email || undefined });
      await loginApi({ username, password });
      window.location.replace(returnTo || "/mypage");
    } catch (err) {
      const e = err as AxiosError<any>;

      if (e?.response?.status === 400 && e.response.data) {
        const msgs = Object.values(e.response.data).flat().join(" ");
        setErr(msgs || "入力内容をご確認ください。");
      } else if (e?.response?.status === 409) {
        setErr("そのユーザー名は既に使われています。");
      } else if ((e?.response?.status ?? 0) >= 500) {
        setErr("サーバーエラーが発生しました。");
      } else {
        setErr("通信に失敗しました。");
      }
    } finally {
      setL(false);
      inFlight.current = false;
    }
  };

  return (
    <main className="p-4 max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4">新規登録</h1>

      {error && <div className="mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm">ユーザー名</label>
          <input
            className="w-full rounded border p-2"
            value={username}
            onChange={(e) => setU(e.target.value)}
            disabled={loading}
            autoComplete="username"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm">メール（任意）</label>
          <input
            className="w-full rounded border p-2"
            value={email}
            onChange={(e) => setE(e.target.value)}
            disabled={loading}
            autoComplete="email"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm">パスワード</label>
          <input
            type="password"
            className="w-full rounded border p-2"
            value={password}
            onChange={(e) => setP(e.target.value)}
            disabled={loading}
            autoComplete="new-password"
          />
          <p className="mt-1 text-xs text-gray-500">8文字以上</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "作成中..." : "アカウント作成"}
        </button>
      </form>
    </main>
  );
}
