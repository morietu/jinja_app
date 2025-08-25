"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    Promise.all([getFavorites(), getVisits()])
      .then(([favs, vis]) => {
        setFavorites(favs);
        setVisits(vis);
        setUser(usr);
      })
      .catch(() => setError("データの取得に失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!user) return;
    try {
      const updated = await updateUser(user);
      setUser(updated);
      alert("更新しました");
    } catch {
      alert("更新に失敗しました");
    }
  };

  if (loading) {
    return <p className="p-4">読み込み中...</p>;
  }
  
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-6">マイページ</h1>

      {error && <p className="text-red-500">{error}</p>}

     {/* ユーザー設定 */}
  <section className="mb-8">
    <h2 className="text-xl font-semibold mb-4">ユーザー設定</h2>

    {user && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1">ニックネーム</label>
              <input
                type="text"
                value={user.nickname}
                onChange={(e) => setUser({ ...user, nickname: e.target.value })}
                className="border p-2 rounded w-full"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">公開設定</label>
              <input
                type="checkbox"
                checked={user.is_public}
                onChange={(e) => setUser({ ...user, is_public: e.target.checked })}
              />{" "}
              公開する
            </div>

            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              保存
            </button>
          </div>
        )}

  </section>

  {/* コンシェルジュ設定 */}
  <section>...</section>

  {/* お気に入り */}
  <section>...</section>

  {/* 参拝履歴 */}
  <section>...</section>

  {/* アカウント管理 */}
  <section>...</section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">お気に入り神社</h2>
        <ul className="grid gap-4">
          {favorites.map((shrine) => (
            <li key={shrine.id}>
              <ShrineCard shrine={shrine} />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">参拝履歴</h2>
        <ul className="grid gap-4">
          {visits.map((visit) => (
            <li key={visit.id}>
              <ShrineCard shrine={visit.shrine} />
              <p className="text-sm text-gray-500">
                参拝日: {new Date(visit.visited_at).toLocaleDateString("ja-JP")}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
