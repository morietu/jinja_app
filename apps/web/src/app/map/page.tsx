// apps/web/src/app/map/page.tsx
import MapScreenLayout from "@/features/map/components/MapScreenLayout";

export const metadata = {
  title: "神社マップ",
  description: "近くの神社を地図で確認",
};

type SP = Record<string, string | string[] | undefined>;

export default async function MapPage({ searchParams }: { searchParams?: Promise<SP> | SP }) {
  const sp = (await searchParams) ?? {};

  const first = (v: string | string[] | undefined) => (typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined);

  const initialSelect = {
    shrineId: (() => {
      const v = first(sp.shrine_id);
      const n = v ? Number(v) : NaN;
      return Number.isFinite(n) && n > 0 ? n : null;
    })(),
    placeId: first(sp.place_id) ?? null,
    lat: (() => {
      const v = first(sp.lat);
      const n = v ? Number(v) : NaN;
      return Number.isFinite(n) ? n : null;
    })(),
    lng: (() => {
      const v = first(sp.lng);
      const n = v ? Number(v) : NaN;
      return Number.isFinite(n) ? n : null;
    })(),
    name: first(sp.name) ?? null,
    addr: first(sp.addr) ?? null,
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-64px)] max-w-md flex-col p-4">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <span>神社マップ</span>
        </h1>
        <p className="text-xs text-gray-500">現在地の近くにある神社を、地図と一覧で確認できます。</p>
      </header>

      <section className="mt-4 flex-1">
        <MapScreenLayout initialSelect={initialSelect} />
      </section>
    </main>
  );
}
