import Link from "next/link";
import { ShortcutCard } from "@/components/ShortcutCard";
import { ShortcutCardGrid } from "@/components/ShortcutCardGrid";
import { getShrine, type Shrine } from "@/lib/api/shrines";
import ShrinePhotoGallery from "@/components/shrine/ShrinePhotoGallery";
import { ShrineSearchToggle } from "@/components/shrine/ShrineSearchToggle";
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

export default async function ShrineDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const numericId = Number(id);

  // ✅ 追加：NaN / 0 / 負数 を弾く（ここがAの修正）
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return (
      <main className="p-4 max-w-md mx-auto space-y-4">
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
      <main className="p-4 max-w-md mx-auto space-y-4">
        <Link
          href={addGoshuinHref}
          className="inline-flex w-full items-center justify-center rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700"
        >
          この神社で御朱印を追加
        </Link>
        
        

        <div className="rounded-xl border bg-white p-4 text-center text-sm">神社の詳細情報が見つかりませんでした。</div>
      </main>
    );
  }

  // ✅ ここで位置情報をまとめて計算しておく
  const lat = shrine.lat ?? shrine.latitude ?? null;
  const lng = shrine.lng ?? shrine.longitude ?? null;


  const latNum = lat == null ? null : Number(lat);
  const lngNum = lng == null ? null : Number(lng);

  const hasLocation = Number.isFinite(latNum) && Number.isFinite(lngNum);

  const mapsRouteHref = hasLocation ? gmapsDirUrl({ dest: { lat: latNum!, lng: lngNum! }, mode: "walk" }) : null;

  const mapHref = hasLocation ? `/map?lat=${latNum}&lng=${lngNum}` : "/map";
  // ✅ ご利益ラベルも shrine 確定後に計算
  const benefitLabels = getBenefitLabels(shrine);

  return (
    <main className="p-4 max-w-md mx-auto space-y-6">
      <ShrineDetailToast shrineId={numericId} />

      {/* ✅ 最優先：経路 */}
      {mapsRouteHref && (
        <a
          href={mapsRouteHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          経路を開く（徒歩）
        </a>
      )}

      {/* 2番手：御朱印 */}
      <Link
        href={addGoshuinHref}
        className="inline-flex w-full items-center justify-center rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700"
      >
        この神社で御朱印を追加
      </Link>

      {/* 3番手：保存 */}
      <ShrineSaveButton shrineId={numericId} nextPath={`/shrines/${numericId}`} />

      
      <section id="goshuins" className="scroll-mt-24" />
      {/* アクションカード */}
      <ShortcutCardGrid>
        <ShortcutCard
          href={mapHref}
          title="地図で周辺を見る"
          description={
            hasLocation ? "この神社の近くの神社を地図で確認できます。" : "地図から神社を探すことができます。"
          }
        />
      </ShortcutCardGrid>

      {/* 🔎 トグル検索 */}
      <ShrineSearchToggle />

      {/* 写真ギャラリー */}
      <article className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <ShrinePhotoGallery shrine={shrine} />
        <section id="goshuins">{/* ここに御朱印一覧 */}</section>

        <div className="p-4 space-y-3">
          <header className="space-y-1">
            <h1 className="text-lg font-bold">{shrine.name_jp}</h1>
          </header>

          {/* 住所 */}
          <section>
            <h2 className="text-xs text-gray-500 font-semibold">住所</h2>
            <p className="text-sm">{shrine.address}</p>
          </section>

          {/* ご利益（B-2 動的表示） */}
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
