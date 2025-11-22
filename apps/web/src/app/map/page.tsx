// apps/web/src/app/map/page.tsx
import MapScreenLayout from "@/features/map/components/MapScreenLayout";

export const metadata = {
  title: "神社マップ",
  description: "近くの神社を地図で確認",
};

export default function MapPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-64px)] max-w-md flex-col p-4">
      {/* ヘッダー */}
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <span>神社マップ</span>
        </h1>
        <p className="text-xs text-gray-500">現在地の近くにある神社を、地図と一覧で確認できます。</p>
      </header>

      {/* 本体：マップ＋近隣リスト */}
      <section className="mt-4 flex-1">
        <MapScreenLayout />
      </section>
    </main>
  );
}
