import Link from "next/link";
import { ShortcutCard } from "@/components/ShortcutCard";
import { ShortcutCardGrid } from "@/components/ShortcutCardGrid";
import { getShrine, type Shrine } from "@/lib/api/shrines";
import ShrinePhotoGallery from "@/components/shrine/ShrinePhotoGallery";
import { ShrineSearchToggle } from "@/components/shrine/ShrineSearchToggle";

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

  let shrine: Shrine | null = null;
  try {
    shrine = await getShrine(numericId);
  } catch {
    shrine = null;
  }

  if (!shrine) {
    return (
      <main className="p-4 max-w-md mx-auto space-y-4">
        <div className="rounded-xl border bg-white p-4 text-center text-sm">神社の詳細情報が見つかりませんでした。</div>
        <Link href="/map" className="inline-flex items-center text-sm text-emerald-700 hover:underline">
          ← 地図に戻る
        </Link>
      </main>
    );
  }

  // ✅ ここで位置情報をまとめて計算しておく
  const lat = shrine.lat ?? shrine.latitude ?? null;
  const lng = shrine.lng ?? shrine.longitude ?? null;

  const hasLocation = lat != null && lng != null;
  const mapHref = hasLocation ? `/map?lat=${lat}&lng=${lng}` : "/map";

  // ✅ ご利益ラベルも shrine 確定後に計算
  const benefitLabels = getBenefitLabels(shrine);

  return (
    <main className="p-4 max-w-md mx-auto space-y-6">
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
