"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Favorite } from "@/lib/api/favorites";
import { normalizeFavorite } from "@/lib/favorites/normalize";
import { removeFavoriteFromCacheByPk, clearFavoritesInFlight } from "@/lib/favoritesCache";

type Props = {
  initialFavorites: Favorite[];
};

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

  const rows = useMemo(() => {
    return items.map((f) => {
      const n = normalizeFavorite(f);
      const href = n.shrineId
        ? `/shrines/${n.shrineId}`
        : n.placeId
          ? `/shrines/from-place/${encodeURIComponent(n.placeId)}`
          : null;

      const title =
        (f.shrine?.name_jp && f.shrine.name_jp.trim()) ||
        (n.shrineId ? `神社 #${n.shrineId}` : n.placeId ? `place_id: ${n.placeId}` : `id: ${f.id}`);

      const sub = (f.shrine?.address && f.shrine.address.trim()) || null;

      return { f, href, title, sub };
    });
  }, [items]);

  async function unSave(f: Favorite) {
    setErr(null);

    // ① UI先に消す
    setItems((prev) => prev.filter((x) => x.id !== f.id));

    const n0 = normalizeFavorite(f);

    try {
      // ② まず pk で消す
      const r0 = await fetch(`/api/favorites/${f.id}/`, {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
      });
      if (!r0.ok) throw new Error(`DELETE failed: ${r0.status}`);

      // ③ 現状再取得
      const latest = await fetchFavoritesDirect();

      // ④ 同一キーが残ってないか（重複掃除）
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

      // ⑤ shared cache 更新
      removeFavoriteFromCacheByPk(f.id);
      clearFavoritesInFlight();

      // ⑥ UIを最新に寄せて、RSCを更新
      const removedIds = new Set(remains.map((y) => y.id));
      setItems(latest.filter((x) => !removedIds.has(x.id)));

      router.refresh();
    } catch {
      setItems((prev) => [f, ...prev]);
      setErr("保存解除に失敗しました");
    }
  }

  return (
    <div className="space-y-3">
      {err && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-orange-50/40 px-4 py-6 text-sm text-gray-700">
          <p className="font-semibold mb-1">お気に入りの神社はまだありません</p>
          <p className="text-xs text-gray-500">神社詳細ページから「保存」をタップすると、ここに一覧で表示されます。</p>
          <Link
            href="/nearby"
            prefetch={false}
            className="mt-3 inline-block rounded-full bg-orange-500 px-4 py-1 text-xs font-medium text-white hover:bg-orange-600"
          >
            近くの神社を探す
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3">
          {rows.map(({ f, href, title, sub }) => (
            <li key={f.id} className="rounded border bg-white p-4">
              <p className="text-sm font-semibold text-gray-900">{title}</p>
              {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}

              <div className="mt-3 flex items-center justify-between gap-3">
                {href ? (
                  <Link href={href} prefetch={false} className="text-sm text-blue-600 hover:underline">
                    神社の詳細を見る
                  </Link>
                ) : (
                  <span className="text-xs text-gray-500">参照先なし（id: {f.id}）</span>
                )}

                <button
                  type="button"
                  onClick={() => unSave(f)}
                  className="shrink-0 rounded-md border px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  保存解除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
