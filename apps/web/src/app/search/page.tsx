// apps/web/src/app/search/page.tsx
import SearchBar from "@/components/SearchBar";
import PlaceCard from "@/components/PlaceCard";
import { gmapsDirUrl } from "@/lib/maps";
import { apiFetch } from "@/lib/api/serverFetch";

type SearchParams = { keyword?: string; locationbias?: string };

// バックエンドの絶対URL（末尾スラッシュ除去）
const API = (
  process.env.NEXT_PUBLIC_API ??
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN ??
  "http://localhost:8000"
).replace(/\/$/, "");

// /api/places/find/ を叩く（将来差し替えはここだけ）
async function fetchPlaces(params: { keyword: string; locationbias?: string }) {
  const usp = new URLSearchParams({
    input: params.keyword,
    language: "ja",
    fields:
      "place_id,name,formatted_address,geometry,photos,opening_hours,rating,user_ratings_total,icon",
  });
  if (params.locationbias) usp.set("locationbias", params.locationbias);

  const r = await apiFetch(`places/find/?${usp.toString()}`, { cache: "no-store" });
  if (!r.ok) return { results: [] as any[] };
  return r.json();
}

export default async function SearchPage({
  searchParams,
}: {
  // ★ Next 15: Promise を await
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

      {/* ★ 初期値は props で渡す */}
      <SearchBar initialKeyword={keyword} />

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
            lat: r.lat ?? r.geometry?.location?.lat,
            lng: r.lng ?? r.geometry?.location?.lng,
          };

          const mapsUrl =
            place.lat && place.lng
              ? gmapsDirUrl({
                  dest: { lat: place.lat, lng: place.lng },
                  mode: "walk",
                })
              : null;

          const planHref =
            `/plan?query=${encodeURIComponent(place.name)}` +
            (locationbias
              ? `&locationbias=${encodeURIComponent(locationbias)}`
              : "");

          return (
            <div key={place.place_id ?? place.name} className="space-y-2">
              <PlaceCard p={place} />
              <div className="flex gap-2">
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    マップで見る（徒歩）
                  </a>
                )}
                <a
                  href={planHref}
                  className="inline-block text-sm px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  ＋近隣も回る
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
