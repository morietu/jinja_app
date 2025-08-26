"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getFavorites } from "@/lib/api/favorites";
import { getVisits, Visit } from "@/lib/api/visits";
import { Shrine } from "@/lib/api/shrines";
import ShrineCard from "@/components/ShrineCard";
import { getCurrentUser, updateUser, User } from "@/lib/api/users";

export default function MyPage() {
  const [favorites, setFavorites] = useState<Shrine[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      try {
        // アクセストークンの確認
        const token = localStorage.getItem("access_token");
        if (!token) {
          router.push("/login");
          return;
        }

        // ユーザー情報とデータを並行して取得
        const [userData, favs, vis] = await Promise.all([
          getCurrentUser(),
          getFavorites(),
          getVisits()
        ]);

        setUser(userData);
        setFavorites(favs);
        setVisits(vis);
      } catch (error) {
        console.error("データ取得エラー:", error);
        if (error.response?.status === 401) {
          // 認証エラーの場合はログインページにリダイレクト
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
    } catch (error) {
      console.error("更新エラー:", error);
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
    <main className="p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
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
      <section className="mb-8 bg-white p-6 rounded-lg shadow">
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
              <span className="text-sm font-medium text-gray-700">プロフィールを公開する</span>
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
      <section className="mb-8 bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">お気に入り神社</h2>
        {favorites.length === 0 ? (
          <p className="text-gray-500">お気に入りの神社はありません</p>
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

      {/* 参拝履歴 */}
      <section className="mb-8 bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">参拝履歴</h2>
        {visits.length === 0 ? (
          <p className="text-gray-500">参拝履歴はありません</p>
        ) : (
          <ul className="space-y-4">
            {visits.map((visit) => (
              <li key={visit.id} className="border-b pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{visit.shrine.name_jp}</h3>
                    <p className="text-sm text-gray-600">
                      {new Date(visit.visited_at).toLocaleDateString('ja-JP')}
                    </p>
                    {visit.note && (
                      <p className="text-sm text-gray-700 mt-1">{visit.note}</p>
                    )}
                  </div>
                  <span className={`px-2 py-1 text-xs rounded ${
                    visit.status === 'added' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {visit.status === 'added' ? '参拝済み' : '削除済み'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
