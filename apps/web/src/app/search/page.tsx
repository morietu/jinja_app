// apps/web/src/app/search/page.tsx
import PlaceCard from "@/components/PlaceCard";

type SearchParams = { keyword?: string; locationbias?: string };

const API = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000").replace(/\/$/, "");

async function fetchPlaces(params: SearchParams) {
  const usp = new URLSearchParams({
    input: params.keyword ?? "",
    language: "ja",
    fields:
      "place_id,name,formatted_address,geometry,photos,opening_hours,rating,user_ratings_total,icon",
  });
  if (params.locationbias) usp.set("locationbias", params.locationbias);

  // ✅ 絶対URLでバックエンド直叩き（SSR）
  const r = await fetch(`${API}/api/places/find_place/?${usp.toString()}`, {
    cache: "no-store",
  });
  if (!r.ok) return { results: [] as any[] };
  return r.json();
}

export default async function SearchPage({
  searchParams,
}: {
  // ✅ Next.js 15: Promise を await してから使う
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const keyword = (sp.keyword ?? "").trim();
  const locationbias = sp.locationbias ?? "";

  const data = keyword
    ? await fetchPlaces({ keyword, locationbias })
    : { results: [] as any[] };

  const results: any[] = Array.isArray((data as any).results)
    ? (data as any).results
    : [];

  return (
    <main className="p-4 max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">検索結果</h1>

      {!keyword && (
        <p className="text-gray-500">キーワードを入力して検索してください。</p>
      )}

      {keyword && results.length === 0 && (
        <p className="text-gray-500">
          「{keyword}」に一致する候補が見つかりませんでした。条件（地名や表記）を変えてお試しください。
        </p>
      )}

      <div className="grid gap-3">
        {results.map((r: any) => {
          const place = {
            place_id: r.place_id,
            name: r.name,
            address: r.address ?? r.formatted_address,
            rating: r.rating,
            user_ratings_total: r.user_ratings_total,
            icon: r.icon,
          };
          const planHref =
            `/plan?query=${encodeURIComponent(place.name)}` +
            (locationbias ? `&locationbias=${encodeURIComponent(locationbias)}` : "");

          return (
            <div key={r.place_id ?? r.name} className="space-y-2">
              <PlaceCard p={place} />
              <a
                href={planHref}
                className="inline-block text-sm px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
              >
                この神社でプラン
              </a>
            </div>
          );
        })}
      </div>
    </main>
  );
}
