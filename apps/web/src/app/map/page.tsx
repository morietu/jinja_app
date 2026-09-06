import MapPageClient from "@/features/map/components/MapPageClient";

export const metadata = {
  title: "近くの神社",
  description: "近くの神社を一覧で確認できる探索用ページです。必要に応じて経路案内へ進めます",
};

export default function MapPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-64px)] max-w-md flex-col px-4 py-6">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-xl font-medium text-[var(--kt-color-text-primary)]">
          <span>近くの神社</span>
        </h1>
        <p className="text-xs leading-6 text-[var(--kt-color-text-secondary)]">今いる場所から、静かにたどれます。</p>
      </header>

      <section className="mt-6 flex-1">
        <MapPageClient />
      </section>
    </main>
  );
}
