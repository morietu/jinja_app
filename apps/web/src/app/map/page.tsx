import MapPageClient from "@/features/map/components/MapPageClient";

export const metadata = {
  title: "近くの神社",
  description: "近くの神社を一覧で確認できる探索用ページです。必要に応じて経路案内へ進めます",
};

export default function MapPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-64px)] max-w-md flex-col p-4">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <span>近くの神社</span>
        </h1>
        <p className="text-xs text-gray-500">
          近くの神社を一覧で確認できる探索用の補助ページです。詳細確認や経路案内に進む前の補助導線として利用します。
        </p>
      </header>

      <section className="mt-4 flex-1">
        <MapPageClient />
      </section>
    </main>
  );
}
