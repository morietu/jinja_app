// apps/web/src/app/favorites/FavoritesListClient.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Favorite } from "@/lib/api/favorites";
import { normalizeFavorite } from "@/lib/favorites/normalize";
import { removeFavoriteFromCacheByPk, clearFavoritesInFlight } from "@/lib/favoritesCache";
import { FavoriteShrineCard } from "@/features/mypage/components/FavoriteShrineCard";



type Props = { initialFavorites: Favorite[] };

async function fetchFavoritesDirect(): Promise<Favorite[]> {
  const r = await fetch("/api/favorites/", { cache: "no-store", credentials: "include" });
  if (!r.ok) return [];
  const data = await r.json();
  return Array.isArray(data) ? data : (data?.results ?? []);
}

export default function FavoritesListClient({ initialFavorites }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<Favorite[]>(initialFavorites);
  const [err, setErr] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<number | null>(null);
  const [busyKind, setBusyKind] = useState<"unsave" | null>(null);

  

  async function unSave(f: Favorite) {
    if (busyId != null) return;
    setBusyId(f.id);
    setBusyKind("unsave");
    setErr(null);

    // ① UI先に消す
    setItems((prev) => prev.filter((x) => x.id !== f.id));
    const n0 = normalizeFavorite(f);

    try {
      // ② pk で消す
      const r0 = await fetch(`/api/favorites/${f.id}/`, {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
      });
      if (!r0.ok) throw new Error(`DELETE failed: ${r0.status}`);

      // ③ 再取得
      const latest = await fetchFavoritesDirect();

      // ④ 同一キー重複の掃除
      const remains = latest.filter((x) => {
        const nx = normalizeFavorite(x);
        if (n0.shrineId != null) return nx.shrineId === n0.shrineId;
        if (n0.placeId) return String(nx.placeId ?? "") === String(n0.placeId);
        return false;
      });

      for (const x of remains) {
        await fetch(`/api/favorites/${x.id}/`, {
          method: "DELETE",
          credentials: "include",
          cache: "no-store",
        }).catch(() => {});
        removeFavoriteFromCacheByPk(x.id);
      }

      removeFavoriteFromCacheByPk(f.id);
      clearFavoritesInFlight();

      const removedIds = new Set(remains.map((y) => y.id));
      const nextItems = latest.filter((x) => !removedIds.has(x.id));
      setItems(nextItems);

      if (nextItems.length === 0) router.push("/map");
    } catch {
      setItems((prev) => [f, ...prev]);
      setErr("保存解除に失敗しました");
    } finally {
      setBusyId(null);
      setBusyKind(null);
    }
  }

  return (
    <div className="space-y-3">
      {err && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-orange-50/40 px-4 py-6 text-sm text-gray-700">
          <p className="mb-1 font-semibold">お気に入りの神社はまだありません</p>
          <p className="text-xs text-gray-500">神社詳細ページから「保存」をタップすると、ここに一覧で表示されます。</p>
          <Link
            href="/map"
            prefetch={false}
            className="mt-3 inline-block rounded-full bg-orange-500 px-4 py-1 text-xs font-medium text-white hover:bg-orange-600"
          >
            近くの神社を探す
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((f) => (
            <FavoriteShrineCard
              key={f.id}
              favorite={f}
              onUnsave={() => unSave(f)}
              disabled={busyId === f.id}
              unsaveLoading={busyId === f.id && busyKind === "unsave"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
