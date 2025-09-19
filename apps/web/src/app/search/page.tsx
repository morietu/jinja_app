// src/app/search/page.tsx
import SearchBar from "@/components/SearchBar";
import PlaceCard from "@/components/PlaceCard";
import { gmapsDirUrl } from "@/lib/maps";
import { apiGet } from "@/lib/api/http";

type SearchParams = { keyword?: string; locationbias?: string };

// ★ ここを B(find, POST) → A(search, GET) に変更
async function fetchPlaces(params: { keyword: string; locationbias?: string }) {
  const usp = new URLSearchParams();
  usp.set("q", params.keyword);                 // ← Aは input ではなく q
  usp.set("language", "ja");
  // fields はサーバ側で固定なら省略可。必要なら付ける：
  usp.set("fields", "place_id,name,formatted_address,geometry,photos,opening_hours,rating,user_ratings_total,icon");
  if (params.locationbias) usp.set("locationbias", params.locationbias);

  // axios 統一：/api 経由（末尾スラ重要）
  return apiGet<{ results: any[] }>(`/places/search/?${usp.toString()}`);
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const sp = searchParams ?? {};
  const keyword = (sp.keyword ?? "").trim();
  const locationbias = sp.locationbias ?? "";

  const data = keyword
    ? await fetchPlaces({ keyword, locationbias })
    : { results: [] as any[] };

  const results: any[] = Array.isArray(data.results) ? data.results : [];

  return (
    <main className="p-4 max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">検索結果</h1>
      <SearchBar initialKeyword={keyword} />
      {!keyword && <p className="text-gray-500">キーワードを入力して検索してください。</p>}
      {keyword && results.length === 0 && (
        <p className="text-gray-500">「{keyword}」に一致する候補が見つかりませんでした。条件（地名や表記）を変えてお試しください。</p>
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
              ? gmapsDirUrl({ dest: { lat: place.lat, lng: place.lng }, mode: "walk" })
              : null;
          const planHref =
            `/plan?query=${encodeURIComponent(place.name)}` +
            (locationbias ? `&locationbias=${encodeURIComponent(locationbias)}` : "");
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
