import MapPageClient from "@/features/map/components/MapPageClient";

export const metadata = {
  title: "近くの神社",
  description: "近くの神社を一覧で確認し、Googleマップで行き方を開けます",
};

export default function MapPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-64px)] max-w-md flex-col p-4">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <span>近くの神社</span>
        </h1>
        <p className="text-xs text-gray-500">近くの神社を一覧で確認できます。地図やルートはGoogleマップで開けます。</p>
      </header>

      <section className="mt-4 flex-1">
        <MapPageClient />
      </section>
    </main>
  );
}
