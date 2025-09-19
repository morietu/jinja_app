"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/hooks/useAuth";
import { useFavorite } from "@/hooks/useFavorite";

type ShrineLite = {
  id?: number | string;
  place_id?: string | null;
  name_jp?: string;
  name?: string;
  address?: string;
  goriyaku_tags?: { id: number; name: string }[];
  is_favorite?: boolean;
  isFavorite?: boolean;
};

type Props = {
  shrine: ShrineLite;
  favoritePk?: number | null;   // マイページから渡せると削除高速化
  initialFav?: boolean;         // 未指定時は is_favorite / isFavorite を吸収
  readOnly?: boolean;           // trueでトグル無効（閲覧専用）
  onToggled?: (next: boolean) => void;
};

export default function ShrineCard({
  shrine,
  favoritePk = null,
  initialFav,
  readOnly = false,
  onToggled,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();

  if (!shrine) return null;

  // 初期fav（命名ゆれ吸収）
  const init =
    typeof initialFav === "boolean"
      ? initialFav
      : ((shrine as any)?.is_favorite ?? (shrine as any)?.isFavorite ?? false);

  // shrineId 正規化（正の整数のみ）
  const shrineIdNum =
    typeof shrine.id === "number" && Number.isInteger(shrine.id) && shrine.id > 0
      ? shrine.id
      : typeof shrine.id === "string" && /^\d+$/.test(shrine.id)
      ? Number(shrine.id)
      : undefined;

  const placeId = shrine.place_id ?? undefined;
  const canFav = !!shrineIdNum || !!placeId; // 手掛かりが無ければ操作しない

  // フック（呼ぶのは canFav が true のときだけ）
  const { fav, busy, toggle } = useFavorite({
    shrineId: shrineIdNum,
    placeId,
    initial: Boolean(init),
    initialFavoritePk: favoritePk ?? null,
    disabled: !canFav,
  });

  const goLoginWithReturn = () => {
    const next = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
    router.push(`/login?next=${encodeURIComponent(next)}`);
  };

  const handleClick = async () => {
    if (readOnly) return;
    if (!isAuthenticated) {
      goLoginWithReturn();
      return;
    }
    if (!canFav) return;

    try {
      const next = !fav;
      await toggle();     // 楽観更新＋失敗時ロールバックはフック側
      onToggled?.(next);
    } catch (e) {
      console.error("お気に入りトグル失敗:", e);
      alert("お気に入りの更新に失敗しました");
    }
  };

  // ▼ ここから下は「必要」です（UI描画）
  return (
    <Card className="hover:shadow-md transition">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>
            <Link
              href={shrineIdNum ? `/shrines/${shrineIdNum}` : "#"}
              className={shrineIdNum ? "text-blue-600 hover:underline" : "text-gray-500 cursor-default"}
              aria-disabled={!shrineIdNum}
            >
              {shrine.name_jp ?? shrine.name ?? "神社"}
            </Link>
          </CardTitle>
          <CardDescription>{shrine.address ?? ""}</CardDescription>
        </div>

        <button
          onClick={handleClick}
          disabled={readOnly || busy || !canFav}
          aria-pressed={fav}
          aria-label={fav ? "お気に入り解除" : "お気に入り追加"}
          title={
            readOnly
              ? "一覧の閲覧専用です"
              : isAuthenticated
              ? (fav ? "お気に入り解除" : "お気に入り追加")
              : "ログインでお気に入りが使えます"
          }
          className={`px-3 py-1 rounded text-sm ${
            readOnly || !canFav
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : isAuthenticated
              ? fav
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-gray-200 hover:bg-gray-300"
              : "bg-gray-100 text-gray-400 hover:bg-gray-200"
          }`}
          data-testid="fav-toggle"
        >
          {busy ? "処理中..." : fav ? "お気に入り解除" : "お気に入り追加"}
        </button>
      </CardHeader>

      <CardContent>
        {!!shrine.goriyaku_tags?.length && (
          <div className="flex flex-wrap gap-2 mb-3">
            {shrine.goriyaku_tags.map((tag) => (
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
