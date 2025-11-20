// apps/web/src/app/shrines/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getShrine, type Shrine } from "@/lib/api/shrines";

type Props = { params: { id: string } };

function ShrineDetailCard({ shrine }: { shrine: Shrine }) {
  const hasTags = Array.isArray((shrine as any).goriyaku_tags) && (shrine as any).goriyaku_tags.length > 0;

  const hasLocation = (shrine as any).latitude != null && (shrine as any).longitude != null;

  const mapsUrl =
    hasLocation && (shrine as any).latitude && (shrine as any).longitude
      ? `https://www.google.com/maps?q=${(shrine as any).latitude},${(shrine as any).longitude}`
      : null;
  
  const kind = (shrine as any).kind as string | undefined;
  const nameRomaji = (shrine as any).name_romaji as string | undefined;

  return (
    <article className="bg-white rounded-2xl shadow-md overflow-hidden">
      {/* 写真ダミー */}
      <div className="aspect-[4/3] w-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
        写真（ダミー）
      </div>

      <div className="p-4 space-y-4">
        {/* 基本情報 */}
        <header className="space-y-1">
          <p className="text-xs text-emerald-700 font-semibold">{kind === "temple" ? "寺院" : "神社"}</p>
          <h1 className="text-xl font-bold">{shrine.name_jp}</h1>

          {nameRomaji && <p className="text-xs text-gray-500 uppercase tracking-wide">{nameRomaji}</p>}

          {shrine.address && <p className="mt-2 text-sm text-gray-700">{shrine.address}</p>}
        </header>

        {/* ご利益タグ */}
        {hasTags && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold text-gray-600">ご利益</h2>
            <div className="flex flex-wrap gap-2">
              {(shrine as any).goriyaku_tags.map((tag: string) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs text-emerald-800"
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* 説明 */}
        {shrine.description && (
          <section className="space-y-1">
            <h2 className="text-xs font-semibold text-gray-600">紹介</h2>
            <p className="text-sm leading-relaxed text-gray-800 whitespace-pre-line">{shrine.description}</p>
          </section>
        )}

        {/* アクセス情報 */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-gray-600">アクセス</h2>
          {hasLocation ? (
            <div className="space-y-1 text-xs text-gray-700">
              <p>現在地からのルートは地図ページから確認できます。</p>
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center text-xs text-emerald-700 font-medium hover:underline"
                >
                  Googleマップで開く
                </a>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-500">アクセス情報は準備中です。</p>
          )}
        </section>
      </div>
    </article>
  );
}

export default async function ShrineDetailPage({ params }: Props) {
  const id = Number(params.id);
  if (Number.isNaN(id)) return notFound();

  const shrine = await getShrine(id).catch(() => null);
  if (!shrine) return notFound();

  return (
    <main className="min-h-[calc(100vh-56px)] bg-slate-50 px-4 pt-4 pb-8">
      <div className="max-w-md mx-auto space-y-4">
        <ShrineDetailCard shrine={shrine} />

        {/* 下部アクション */}
        <div className="flex justify-between gap-3 text-sm">
          <Link
            href="/map"
            className="flex-1 text-center rounded-full border border-gray-300 py-2 font-medium text-gray-700 bg-white active:scale-[0.98]"
          >
            地図に戻る
          </Link>
          <button
            type="button"
            className="flex-1 rounded-full bg-emerald-600 text-white py-2 font-medium active:scale-[0.98]"
          >
            行きたいに追加（ダミー）
          </button>
        </div>
      </div>
    </main>
  );
}
