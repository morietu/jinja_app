// apps/web/src/app/shrines/[id]/page.tsx
import Link from "next/link";
import { ShortcutCard } from "@/components/ShortcutCard";
import { ShortcutCardGrid } from "@/components/ShortcutCardGrid";
import { getShrine, type Shrine } from "@/lib/api/shrines";
import ShrinePhotoGallery from "@/components/shrine/ShrinePhotoGallery";
import { gmapsDirUrl } from "@/lib/maps";
import { ShrineDetailToast } from "@/components/shrine/ShrineDetailToast";
import ShrineSaveButton from "@/components/shrine/ShrineSaveButton";

// ✅ コンポーネントの外でOK
function getBenefitLabels(shrine: Shrine): string[] {
  if (Array.isArray(shrine.goriyaku_tags) && shrine.goriyaku_tags.length > 0) {
    return shrine.goriyaku_tags.map((t) => t?.name?.trim()).filter((name): name is string => Boolean(name));
  }
  if (typeof shrine.goriyaku === "string" && shrine.goriyaku.trim().length > 0) {
    return shrine.goriyaku
      .split(/[、,／/]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ ctx?: string; tid?: string }>;
};



export default async function Page({ params, searchParams }: Props) {
  
  const { id } = await params;
  const sp = (searchParams ? await searchParams : undefined) ?? {};

  const numericId = Number(id);

  if (!Number.isFinite(numericId) || numericId <= 0) {
    return (
      <main className="mx-auto max-w-md space-y-4 p-4">
        <div className="rounded-xl border bg-white p-4 text-center text-sm">不正な神社IDです。</div>
        <Link href="/map" className="inline-flex items-center text-sm text-emerald-700 hover:underline">
          ← 地図に戻る
        </Link>
      </main>
    );
  }

  const addGoshuinHref = `/mypage?tab=goshuin&shrine=${numericId}#goshuin-upload`;

  let shrine: Shrine | null = null;
  try {
    shrine = await getShrine(numericId);
  } catch {
    shrine = null;
  }

  if (!shrine) {
    return (
      <main className="mx-auto max-w-md space-y-4 p-4">
        <Link
          href={addGoshuinHref}
          className="inline-flex w-full items-center justify-center rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700"
        >
          この神社で御朱印を追加
        </Link>

        <div className="rounded-xl border bg-white p-4 text-center text-sm">神社の詳細情報が見つかりませんでした。</div>

        <Link href="/map" className="inline-flex items-center text-sm text-emerald-700 hover:underline">
          ← 地図に戻る
        </Link>
      </main>
    );
  }

  const latNum = Number(shrine.lat ?? shrine.latitude ?? NaN);
  const lngNum = Number(shrine.lng ?? shrine.longitude ?? NaN);

  const hasLocation =
    Number.isFinite(latNum) &&
    Number.isFinite(lngNum) &&
    latNum >= -90 &&
    latNum <= 90 &&
    lngNum >= -180 &&
    lngNum <= 180;

  const mapsRouteHref = hasLocation ? gmapsDirUrl({ dest: { lat: latNum, lng: lngNum }, mode: "walk" }) : null;

  const mapHref = hasLocation ? `/map?lat=${latNum}&lng=${lngNum}` : "/map";

  const benefitLabels = getBenefitLabels(shrine);

  return (
    <main className="mx-auto max-w-md space-y-6 p-4">
      <ShrineDetailToast shrineId={numericId} />

      {/* ✅ 1) ルート（唯一） */}
      {mapsRouteHref && (
        <a
          href={mapsRouteHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Googleマップでルートを見る
        </a>
      )}

      {!mapsRouteHref && (
        <div className="rounded-xl border bg-white p-3 text-xs text-slate-500">
          位置情報が未登録のためルートを表示できません。
        </div>
      )}

      {/* 2) 御朱印 */}
      <Link
        href={addGoshuinHref}
        className="inline-flex w-full items-center justify-center rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700"
      >
        この神社で御朱印を追加
      </Link>

      {/* 3) 保存 */}
      <ShrineSaveButton shrineId={numericId} nextPath={`/shrines/${numericId}`} />

      {/* 4) 周辺 */}
      <ShortcutCardGrid>
        <ShortcutCard
          href={mapHref}
          title="地図で周辺を見る"
          description={
            hasLocation ? "この神社の近くの神社を地図で確認できます。" : "地図から神社を探すことができます。"
          }
        />
      </ShortcutCardGrid>

      <article className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <ShrinePhotoGallery shrine={shrine} />

        <div className="space-y-3 p-4">
          <header className="space-y-1">
            <h1 className="text-lg font-bold">{shrine.name_jp}</h1>
          </header>

          <section>
            <h2 className="text-xs font-semibold text-gray-500">住所</h2>
            <p className="text-sm">{shrine.address}</p>
          </section>

          <section className="space-y-1 text-sm">
            <h2 className="text-xs font-semibold text-gray-500">ご利益</h2>
            {benefitLabels.length === 0 ? (
              <p className="text-xs text-gray-400">ご利益情報は準備中です。</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {benefitLabels.map((label) => (
                  <span
                    key={label}
                    className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
          </section>
        </div>
      </article>
    </main>
  );
}
