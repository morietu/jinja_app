// apps/web/src/app/signup/SignupForm.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signup } from "@/lib/api/auth";

export default function SignupForm() {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [e, setE] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const ok = await signup({
        username: u.trim(),
        password: p,
        email: e.trim() || undefined,
      });
      if (!ok) {
        setErr("登録に失敗しました（入力内容・重複をご確認ください）");
        return;
      }
      router.replace("/login");
    } catch {
      setErr("通信エラーが発生しました。時間をおいて再度お試しください。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="max-w-sm mx-auto p-4 space-y-3">
      <h1 className="text-xl font-bold">新規登録</h1>
      {err && <p className="text-red-600 text-sm">{err}</p>}
      <input
        className="border p-2 w-full"
        placeholder="ユーザー名"
        value={u}
        onChange={(e) => setU(e.target.value)}
        autoComplete="username"
        required
      />
      <input
        type="email"
        className="border p-2 w-full"
        placeholder="メールアドレス"
        value={e}
        onChange={(e) => setE(e.target.value)}
        autoComplete="email"
      />
      <input
        type="password"
        className="border p-2 w-full"
        placeholder="パスワード"
        value={p}
        onChange={(e) => setP(e.target.value)}
        autoComplete="new-password"
        required
      />
      <button disabled={busy} className="w-full bg-blue-600 text-white rounded py-2">
        {busy ? "登録中..." : "登録"}
      </button>
    </form>
  );
}
