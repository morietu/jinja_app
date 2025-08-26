"use client";

import { useState } from "react";
import { login as loginApi } from "@/lib/api/auth";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!username || !password) {
      setError("ユーザー名とパスワードを入力してください");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log("ログイン試行中...", { username });
      
      const response = await loginApi(username, password);
      console.log("ログインAPIレスポンス:", response);
      
      // ログイン成功後、ユーザー情報を取得して状態を更新
      try {
        const userResponse = await fetch('http://localhost:8000/users/me/', {
          headers: {
            'Authorization': `Bearer ${response.access}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log("ユーザー情報取得レスポンス:", userResponse);
        
        if (userResponse.ok) {
          const userData = await userResponse.json();
          console.log("ユーザーデータ:", userData);
          login(userData);
          alert("ログイン成功！");
          // ユーザーページに遷移
          router.push("/mypage");
        } else {
          const errorText = await userResponse.text();
          console.error("ユーザー情報取得エラー:", errorText);
          throw new Error(`ユーザー情報の取得に失敗しました: ${userResponse.status}`);
        }
      } catch (userError) {
        console.error("ユーザー情報取得エラー:", userError);
        // ユーザー情報の取得に失敗しても、ログイン自体は成功している可能性がある
        alert("ログイン成功！ユーザー情報の取得に失敗しました。");
        router.push("/mypage");
      }
    } catch (error: any) {
      console.error("ログインエラー詳細:", error);
      
      let errorMessage = "ログインに失敗しました。";
      
      if (error.response) {
        // APIからのエラーレスポンス
        console.error("APIエラーレスポンス:", error.response);
        if (error.response.status === 401) {
          errorMessage = "ユーザー名またはパスワードが正しくありません。";
        } else if (error.response.status === 400) {
          errorMessage = "リクエストが正しくありません。";
        } else if (error.response.status === 500) {
          errorMessage = "サーバーエラーが発生しました。";
        } else {
          errorMessage = `エラーが発生しました (${error.response.status})`;
        }
        
        if (error.response.data) {
          console.error("APIエラーデータ:", error.response.data);
        }
      } else if (error.request) {
        // リクエストは送信されたがレスポンスがない
        console.error("リクエストエラー:", error.request);
        errorMessage = "サーバーに接続できません。バックエンドが起動しているか確認してください。";
      } else {
        // その他のエラー
        errorMessage = error.message || "予期しないエラーが発生しました。";
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  return (
    <main className="p-4 max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4">ログイン</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
            ユーザー名
          </label>
          <input
            id="username"
            type="text"
            placeholder="ユーザー名を入力"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyPress={handleKeyPress}
            className="border border-gray-300 p-2 w-full rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            パスワード
          </label>
          <input
            id="password"
            type="password"
            placeholder="パスワードを入力"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={handleKeyPress}
            className="border border-gray-300 p-2 w-full rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "ログイン中..." : "ログイン"}
        </button>
      </div>

      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600">
          アカウントをお持ちでない方は
          <button 
            onClick={() => router.push("/register")}
            className="text-blue-600 hover:underline ml-1"
          >
            新規登録
          </button>
        </p>
      </div>

      {/* デバッグ情報 */}
      <div className="mt-6 p-4 bg-gray-100 rounded text-xs">
        <p className="font-semibold mb-2">デバッグ情報:</p>
        <p>API Base: {process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"}</p>
        <p>現在のURL: {typeof window !== 'undefined' ? window.location.href : 'N/A'}</p>
      </div>
    </main>
  );
}
