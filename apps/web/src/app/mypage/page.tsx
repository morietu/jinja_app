"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getFavorites } from "@/lib/api/favorites";


import { Shrine } from "@/lib/api/shrines";
import ShrineCard from "@/components/ShrineCard";
import { getCurrentUser, updateUser, User } from "@/lib/api/users";
import { getConciergeHistory, ConciergeHistory } from "@/lib/api/concierge";
import Link from "next/link";
import { refreshAccessToken } from "@/lib/api/auth";
import { Goshuin, getGoshuin } from "@/lib/api/goshuin";
import Image from "next/image";




export default function MyPage() {
  const [favorites, setFavorites] = useState<Shrine[]>([]);

  const [history, setHistory] = useState<ConciergeHistory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const [goshuin, setGoshuin] = useState<Goshuin[]>([]);

  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      try {
        let token = localStorage.getItem("access_token");

        if (!token) {
          // access_token が無ければ refresh を試す
          token = await refreshAccessToken();
        if (!token) {
          router.push("/login");
          return;
        }
      }

        let [userData, favs, gos, hist]: [User, Shrine[], Goshuin[], ConciergeHistory[]] = await Promise.all([
          getCurrentUser(),
          getFavorites(),
          getGoshuin(),
          getConciergeHistory(),
        ]);

        console.log("ユーザーデータ:", userData);
        console.log("お気に入り:", favs);
        console.log("御朱印:", gos);
        console.log("診断履歴:", hist);

        setUser(userData);
        setFavorites(favs);
        setGoshuin(gos);
        setHistory(hist);
      } catch (err: any) {
        console.error("データ取得エラー:", err);
        if (err.response?.status === 401) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          router.push("/login");
          return;
        }
        setError("データの取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndLoadData();
  }, [router]);

  const handleSave = async () => {
    if (!user) return;
    try {
      const updated = await updateUser({
        nickname: user.nickname,
        is_public: user.is_public,
      });
      setUser(updated);
      alert("ユーザー情報を更新しました！");
    } catch (err) {
      console.error("更新エラー:", err);
      alert("更新に失敗しました");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500">ユーザー情報の取得に失敗しました</p>
        <button
          onClick={() => router.push("/login")}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          ログインページに戻る
        </button>
      </div>
    );
  }

  return (
    <main className="p-4 max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-center mb-6">
        <Link href="/" className="text-blue-600 hover:underline">
            ホームに戻る
        </Link>
        <h1 className="text-2xl font-bold">マイページ</h1>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
            ログアウト
        </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* ユーザー設定 */}
        <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">ユーザー設定</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ユーザー名
              </label>
              <input
                type="text"
                value={user.username}
                disabled
                className="border border-gray-300 p-2 rounded w-full bg-gray-50"
              />
              </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ニックネーム
            </label>
            <input
              type="text"
              value={user.nickname}
              onChange={(e) => setUser({ ...user, nickname: e.target.value })}
              className="border border-gray-300 p-2 rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={user.is_public}
                onChange={(e) => setUser({ ...user, is_public: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-700">
                プロフィールを公開する
              </span>
            </label>
          </div>

          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            保存
          </button>
        </div>
      </section>

      {/* お気に入り神社 */}
<section className="bg-white p-6 rounded-lg shadow">
  <h2 className="text-xl font-semibold mb-4">お気に入り神社</h2>
  {favorites.length === 0 ? (
    <div className="flex flex-col items-center text-gray-500">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-12 w-12 mb-2 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
        />
      </svg>
      <p>お気に入りの神社はまだありません</p>
    </div>
  ) : (
    <ul className="grid gap-4">
      {favorites.map((shrine) => (
        <li key={shrine.id}>
          <ShrineCard shrine={shrine} />
        </li>
      ))}
    </ul>
  )}
</section>

      {/* 御朱印帳 */}
      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">御朱印帳</h2>
        {goshuin.length === 0 ? (
          <p className="text-gray-500">御朱印はまだ投稿されていません</p>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {goshuin.map((item) => (
              <li key={item.id} className="border rounded overflow-hidden shadow-sm">
                <Link href={`/shrines/${item.shrine}`}>
                  <Image
                    src={item.image_url || "/placeholder.png"}
                    alt={item.shrine_name || "御朱印"}
                    width={300}
                    height={200}
                    className="w-full h-40 object-cover"
                  />
                  <div className="p-2 text-sm">
                    <p className="font-bold">{item.shrine_name}</p>
                    <p className="text-gray-600 text-xs">
                      {new Date(item.created_at).toLocaleDateString("ja-JP")}
                    </p>
                  </div>
                </Link>
              </li>

            ))}
          </ul>
        )}
      </section>






      {/* コンシェルジュ診断履歴 */}
      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">コンシェルジュ診断履歴</h2>
        {history.length === 0 ? (
          <p className="text-gray-500">履歴はまだありません</p>
        ) : (
          <ul className="space-y-4">
            {history.map((h) => (
              <li key={h.id} className="border rounded p-3 bg-gray-50">
                <div className="flex justify-between items-center">
                  <p className="font-bold text-lg">{h.shrine_name}</p>
                  {h.shrine && (
                    <Link
                      href={`/shrines/${h.shrine}`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      詳細を見る →
                    </Link>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">{h.reason}</p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {h.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(h.created_at).toLocaleString("ja-JP")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
