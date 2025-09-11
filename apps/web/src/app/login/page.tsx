"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AxiosError } from "axios";
import { login as loginApi } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/users";
import { useAuth } from "@/lib/hooks/useAuth";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!username || !password) {
      setError("ユーザー名とパスワードを入力してください");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // 1) ログイン（トークン保存＆setAuthToken まで内部で実施）
      await loginApi(username, password);

      // 2) me 取得（失敗しても致命的でない）
      try {
        const me = await getCurrentUser();
        if (me) login(me);
      } catch (e) {
        console.warn("ログイン後の /users/me 取得に失敗しました:", e);
      }

      // 3) 遷移
      const next = searchParams?.get("next") || "/mypage";
      router.replace(next);
    } catch (error: unknown) {
      const err = error as AxiosError;
      let msg = "ログインに失敗しました。";
      if (err.response) {
        if (err.response.status === 401) msg = "ユーザー名またはパスワードが正しくありません。";
        else if (err.response.status === 400) msg = "リクエストが正しくありません。";
        else if (err.response.status >= 500) msg = "サーバーエラーが発生しました。";
        else msg = `エラーが発生しました (${err.response.status})`;
      } else if (err.request) {
        msg = "サーバーに接続できません。バックエンドが起動しているか確認してください。";
      } else {
        msg = err instanceof Error ? err.message : msg;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => e.key === "Enter" && handleLogin();

  return (
    <main className="p-4 max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4">ログイン</h1>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">ユーザー名</label>
          <input className="border p-2 w-full rounded" value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={onKey} disabled={loading} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">パスワード</label>
          <input type="password" className="border p-2 w-full rounded" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={onKey} disabled={loading} />
        </div>
        <button onClick={handleLogin} disabled={loading} className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
          {loading ? "ログイン中..." : "ログイン"}
        </button>
      </div>
    </main>
  );
}
