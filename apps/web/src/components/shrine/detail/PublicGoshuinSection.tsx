// apps/web/src/components/shrine/detail/PublicGoshuinSection.tsx
import Link from "next/link";
import Image from "next/image";
import DetailSection from "@/components/shrine/DetailSection";

export type PublicGoshuinItem = {
  id: number;
  title?: string | null;
  created_at?: string;
  image_url?: string | null;
};

export default function PublicGoshuinSection({
  items,
  addGoshuinHref,
  // ✅ ヘッダ密度を上げないため、原則 undefined 運用
  sendingLabel,
  limit, // ✅追加
  seeAllHref,
  seeAllLabel = "すべて見る",
}: {
  items: PublicGoshuinItem[];
  addGoshuinHref?: string | null;
  sendingLabel?: string;
  limit?: number; // ✅追加
  seeAllHref?: string | null;
  seeAllLabel?: string;
}) {
  const list = Array.isArray(items) ? items : [];
  const n = typeof limit === "number" && Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : list.length;

  const shown = list.slice(0, n);
  const hasMore = list.length > shown.length;
  const moreCount = hasMore ? list.length - shown.length : 0;

  return (
    <DetailSection
      title="公開御朱印"
      right={
        <div className="flex items-center gap-2">
          {hasMore && seeAllHref ? (
            <Link href={seeAllHref} className="text-xs font-semibold text-slate-700 hover:underline">
              {seeAllLabel}
              {/* 任意：密度上げたくないならこの行を消す */}
              {moreCount > 0 ? <span className="ml-1 text-slate-500">（他{moreCount}件）</span> : null}
            </Link>
          ) : null}

          {addGoshuinHref ? (
            <Link
              href={addGoshuinHref}
              className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white"
            >
              + 追加
            </Link>
          ) : null}
        </div>
      }
    >
      {sendingLabel ? <p className="text-xs text-slate-500">{sendingLabel}</p> : null}

      {shown.length === 0 ? (
        <p className="text-xs text-slate-500">この神社に紐づく公開御朱印はまだありません。</p>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {shown.map((g) => (
            <div key={g.id} className="overflow-hidden rounded-xl border bg-white">
              <div className="aspect-[4/5] bg-slate-100">
                {g.image_url ? (
                  <Image
                    src={g.image_url}
                    alt={g.title ?? "goshuin"}
                    width={600}
                    height={750}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : null}
              </div>
              <div className="p-2">
                <p className="truncate text-xs text-slate-700">{(g.title ?? "").trim() || "（タイトルなし）"}</p>
                {g.created_at ? <p className="truncate text-[11px] text-slate-500">{g.created_at}</p> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </DetailSection>
  );
}
