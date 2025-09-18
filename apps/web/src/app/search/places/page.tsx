// apps/web/src/app/search/places/page.tsx
import PlaceCard from "@/components/PlaceCard";
import { gmapsDirUrl } from "@/lib/maps";

type SearchParams = {
  keyword?: string;
  locationbias?: string;
};

async function fetchPlaces(params: SearchParams) {
  const usp = new URLSearchParams({
    input: params.keyword ?? "",
    language: "ja",
    fields:
      "place_id,name,formatted_address,geometry,photos,opening_hours,rating,user_ratings_total,icon",
  });
  if (params.locationbias) usp.set("locationbias", params.locationbias);

  // 相対パスでバックエンドへ（rewrites が効く）
  const r = await apiFetch(`places/find/?${usp.toString()}`, { cache: "no-store" });
  if (!r.ok) return { results: [] as any[] };
  return r.json();
}

export default async function Page({
  searchParams,
}: {
  // ★ Next.js 15: Promise を受け取る
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // ★ ここで await
  const sp = await searchParams;
  const keyword =
    typeof sp.keyword === "string" ? sp.keyword.trim() : "";
  const locationbias =
    typeof sp.locationbias === "string" ? sp.locationbias : "";

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
            lat: r.lat ?? r.geometry?.location?.lat,
            lng: r.lng ?? r.geometry?.location?.lng,
          };

          const mapsUrl =
            typeof place.lat === "number" && typeof place.lng === "number"
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
            <div key={r.place_id ?? r.name} className="space-y-2">
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
