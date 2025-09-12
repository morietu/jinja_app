// apps/web/src/components/ShrineCard.tsx
"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useFavorite } from "@/hooks/useFavorite";
import { useAuth } from "@/lib/hooks/useAuth";
import type { Shrine } from "@/lib/api/shrines";

type Props = {
  shrine: Shrine | null | undefined;
  initialFav?: boolean;
  onToggled?: (isFav: boolean) => void;
};

export default function ShrineCard({ shrine, initialFav, onToggled }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();

  // shrine 未到着なら描画しない（スケルトンを入れてもOK）
  if (!shrine) return null;

  // initial の決定（APIの命名揺れ is_favorite / isFavorite どちらにも対応）
  const rawInit =
    typeof initialFav === "boolean"
      ? initialFav
      : (shrine as any)?.is_favorite ?? (shrine as any)?.isFavorite ?? false;
  const init = Boolean(rawInit);

  const shrineId = shrine?.id != null ? String(shrine.id) : null;
  const { fav, busy, toggle } = useFavorite(init, shrineId ?? "");

  const goLoginWithReturn = () => {
    const next = `${pathname}${searchParams?.toString() ? `?${searchParams?.toString()}` : ""}`;
    router.push(`/login?next=${encodeURIComponent(next)}`);
  };

  const handleClick = async () => {
    if (!shrineId) return; // IDが無ければ何もしない
    if (!isAuthenticated) {
      goLoginWithReturn();
      return;
    }
    const next = !fav;     // 次の状態を先に計算（コールバック用）
    await toggle();        // フック内で楽観更新＋ロールバック
    onToggled?.(next);
  };

  return (
    <Card className="hover:shadow-md transition">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>
            <Link href={`/shrines/${shrine.id}`} className="text-blue-600 hover:underline">
              {(shrine as any)?.name_jp ?? (shrine as any)?.name ?? "神社"}
            </Link>
          </CardTitle>
          <CardDescription>{(shrine as any)?.address ?? ""}</CardDescription>
        </div>

        {/* ★ お気に入りトグル */}
        <button
          onClick={handleClick}
          disabled={busy || !shrineId}
          aria-pressed={fav}
          aria-label={fav ? "お気に入り解除" : "お気に入り追加"}
          title={
            isAuthenticated
              ? fav
                ? "お気に入り解除"
                : "お気に入り追加"
              : "ログインでお気に入りが使えます"
          }
          className={`px-3 py-1 rounded text-sm ${
            isAuthenticated
              ? fav
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-gray-200 hover:bg-gray-300"
              : "bg-gray-100 text-gray-400 hover:bg-gray-200"
          }`}
          data-testid="fav-toggle"
        >
          {busy
            ? "処理中..."
            : isAuthenticated
            ? fav
              ? "お気に入り解除"
              : "お気に入り追加"
            : "ログインでお気に入り"}
        </button>
      </CardHeader>

      <CardContent>
        {(shrine as any)?.goriyaku && (
          <p className="text-sm mb-2">ご利益: {(shrine as any).goriyaku}</p>
        )}
        {!!(shrine as any)?.goriyaku_tags?.length && (
          <div className="flex flex-wrap gap-2 mb-3">
            {(shrine as any).goriyaku_tags.map((tag: any) => (
              <span key={tag.id} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
