// apps/web/src/app/shrines/[id]/page.tsx

import Link from "next/link";
import { ShortcutCard } from "@/components/ShortcutCard";
import { ShortcutCardGrid } from "@/components/ShortcutCardGrid";

type ShrineDetailPageParams = {
  id: string;
};

type ShrineDetail = {
  id: number;
  name_jp: string;
  address: string;
  kind?: "shrine" | "temple";
  name_romaji?: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export default async function ShrineDetailPage({ params }: { params: Promise<ShrineDetailPageParams> }) {
  // ★ ここで Promise を unwrap
  const { id } = await params;
  const numericId = Number(id);

  if (Number.isNaN(numericId)) {
    return (
      <main className="p-4 max-w-5xl mx-auto space-y-4">
        <div className="text-sm text-red-600">不正なIDです。</div>
        <Link href="/map" className="text-sm text-emerald-700 hover:underline">
          地図に戻る
        </Link>
      </main>
    );
  }

  const res = await fetch(`${API_BASE}/api/shrines/${numericId}/`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <main className="p-4 max-w-md mx-auto space-y-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-700">神社の詳細情報が見つかりませんでした。</p>
        </div>
        <Link href="/map" className="inline-flex items-center text-sm text-emerald-700 hover:underline">
          ← 地図に戻る
        </Link>
      </main>
    );
  }

  const shrine = (await res.json()) as ShrineDetail;

  return (
    <main className="p-4 max-w-md mx-auto space-y-4">
      <h1 className="text-xl font-bold">{shrine.name_jp}</h1>

      <ShortcutCardGrid>
        <ShortcutCard
          href="/map"
          title="地図で周辺を見る"
          description="この神社の周辺や近くの神社を地図で確認できます。"
        />
        <ShortcutCard
          href="/search"
          title="別の神社を探す"
          description="条件を変えて別の神社を探したいときはこちら。"
        />
        <ShortcutCard href="/" title="トップに戻る" description="一覧やランキングからも神社を探せます。" />
      </ShortcutCardGrid>

      <article className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="h-40 w-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
          写真（ダミー）
        </div>

        <div className="p-4 space-y-3">
          <header className="space-y-1">
            <p className="text-xs text-emerald-700 font-semibold">{shrine.kind === "shrine" ? "神社" : "寺院"}</p>
            <h1 className="text-lg font-bold">{shrine.name_jp}</h1>
            {shrine.name_romaji && (
              <p className="text-xs text-gray-500 uppercase tracking-wide">{shrine.name_romaji}</p>
            )}
          </header>

          <section className="space-y-1 text-sm">
            <h2 className="text-xs font-semibold text-gray-500">住所</h2>
            <p className="text-gray-800">{shrine.address}</p>
          </section>

          <section className="space-y-1 text-sm">
            <h2 className="text-xs font-semibold text-gray-500">ご利益</h2>
            <div className="flex flex-wrap gap-1">
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                開運
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                恋愛・縁結び
              </span>
            </div>
          </section>
        </div>
      </article>
    </main>
  );
}
