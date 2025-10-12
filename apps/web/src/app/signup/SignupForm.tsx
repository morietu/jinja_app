"use client";
import { useState, useRef } from "react";
import type { AxiosError } from "axios";
import { signup, login as loginApi } from "@/lib/api/auth";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";

export default function SignupForm() {
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [email, setE] = useState("");
  const [loading, setL] = useState(false);
  const [error, setErr] = useState<string|null>(null);
  const inFlight = useRef(false);
  const router = useRouter();
  const { login: syncMe } = useAuth();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current || loading) return;
    if (!username || password.length < 8) {
      setErr("ユーザー名と8文字以上のパスワードを入力してください"); return;
    }
    setErr(null); setL(true); inFlight.current = true;
    try {
      await signup({ username, password, email: email || undefined });
      await loginApi({ username, password });
      try { await syncMe(); } catch {}
      router.replace("/mypage");
    } catch (err) {
      const e = err as AxiosError<any>;
      if (e?.response?.status === 400 && e.response.data) {
        // DRFのエラー {username:["この...", ...], password:[...]} を整形
        const msgs = Object.values(e.response.data).flat().join(" ");
        setErr(msgs || "入力内容をご確認ください。");
      } else if (e?.response?.status === 409) {
        setErr("そのユーザー名は既に使われています。");
      } else if ((e?.response?.status ?? 0) >= 500) {
        setErr("サーバーエラーが発生しました。");
      } else {
        setErr("通信に失敗しました。");
      }
    } finally { setL(false); inFlight.current = false; }
  };

  return (
    <main className="p-4 max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4">新規登録</h1>
      {error && <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>}
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">ユーザー名</label>
          <input className="border p-2 w-full rounded" value={username} onChange={e=>setU(e.target.value)} disabled={loading} autoComplete="username" />
        </div>
        <div>
          <label className="block text-sm mb-1">メール（任意）</label>
          <input className="border p-2 w-full rounded" value={email} onChange={e=>setE(e.target.value)} disabled={loading} autoComplete="email" />
        </div>
        <div>
          <label className="block text-sm mb-1">パスワード</label>
          <input type="password" className="border p-2 w-full rounded" value={password} onChange={e=>setP(e.target.value)} disabled={loading} autoComplete="new-password" />
          <p className="text-xs text-gray-500 mt-1">8文字以上</p>
        </div>
        <button type="submit" disabled={loading} className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
          {loading ? "作成中..." : "アカウント作成"}
        </button>
      </form>
    </main>
  );
}
