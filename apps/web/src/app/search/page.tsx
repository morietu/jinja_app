// src/app/search/page.tsx
import { headers } from "next/headers";
import SearchBar from "@/components/SearchBar";
import PlaceCard from "@/components/PlaceCard";
import { gmapsDirUrl } from "@/lib/maps";





type RawSearchParams = Record<string, string | string[] | undefined>;

type FetchParams = { keyword: string; locationbias?: string };

async function fetchPlaces(baseUrl: string, params: FetchParams) {
  if (!params?.keyword) throw new Error("keyword is required");
  const usp = new URLSearchParams();
  usp.set("q", params.keyword);
  usp.set("language", "ja");
  usp.set("fields", "place_id,name,formatted_address,geometry,photos,opening_hours,rating,user_ratings_total,icon");
  if (params.locationbias) usp.set("locationbias", params.locationbias);

  const url = new URL(`/api/places/search?${usp.toString()}`, baseUrl);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("search failed");
  return res.json() as Promise<{ results: any[] }>;
}


function parseLocationBiasCenter(lb: string): { lat: number; lng: number } | null {
  // 例: "circle:2000@35.681236,139.767125" / "point:35.681236,139.767125"
  const m = lb.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const aa = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(aa)));
}


export default async function SearchPage({
  searchParams,
}: {
  // Next 15 で Promise になる想定
  searchParams?: Promise<RawSearchParams>;
}) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

  const sp: RawSearchParams = (await searchParams) ?? {};

  // URL は ?keyword= でも ?q= でも受ける
  const kwRaw = sp.keyword ?? sp.q ?? "";
  const keyword = Array.isArray(kwRaw) ? kwRaw[0] : kwRaw;

  const lbRaw = sp.locationbias ?? "";
  const locationbias = Array.isArray(lbRaw) ? lbRaw[0] : lbRaw;

  // --- フィルタ（URLで受ける） ---
  const minRatingRaw = sp.minRating ?? "0";
  const minRatingStr = Array.isArray(minRatingRaw) ? minRatingRaw[0] : minRatingRaw;
  const minRating = Math.max(0, Math.min(5, Number(minRatingStr) || 0));

  const openNowRaw = sp.openNow ?? "0";
  const openNowStr = Array.isArray(openNowRaw) ? openNowRaw[0] : openNowRaw;
  const openNow = openNowStr === "1" || openNowStr === "true";


  const data = keyword
    ? await fetchPlaces(baseUrl, { keyword: keyword.trim(), locationbias })
    : { results: [] as any[] };

  const results: any[] = Array.isArray(data.results) ? data.results : [];

  const center = locationbias ? parseLocationBiasCenter(locationbias) : null;

  const ranked = [...results].sort((x, y) => {
    const xl = x.lat ?? x.geometry?.location?.lat;
    const xg = x.lng ?? x.geometry?.location?.lng;
    const yl = y.lat ?? y.geometry?.location?.lat;
    const yg = y.lng ?? y.geometry?.location?.lng;

    const xd = center && Number.isFinite(xl) && Number.isFinite(xg) ? haversineKm(center, { lat: xl, lng: xg }) : null;
    const yd = center && Number.isFinite(yl) && Number.isFinite(yg) ? haversineKm(center, { lat: yl, lng: yg }) : null;

    // ① 距離（中心がある時だけ）
    if (xd != null && yd != null && xd !== yd) return xd - yd;
    if (xd != null && yd == null) return -1;
    if (xd == null && yd != null) return 1;

    // ② 評価（高い順）
    const xr = Number(x.rating ?? 0);
    const yr = Number(y.rating ?? 0);
    if (yr !== xr) return yr - xr;

    // ③ レビュー数（多い順）
    const xu = Number(x.user_ratings_total ?? 0);
    const yu = Number(y.user_ratings_total ?? 0);
    return yu - xu;
  });
  
    const filtered = ranked.filter((r: any) => {
      // rating フィルタ
      const rating = Number(r.rating ?? 0);
      if (minRating > 0 && rating < minRating) return false;

      // openNow フィルタ（open_now が true のものだけ）
      if (openNow) {
        const isOpen = r.opening_hours?.open_now;
        if (isOpen !== true) return false;
      }
      return true;
    });


  return (
    <main className="p-4 max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">検索結果</h1>
      <SearchBar
        initialKeyword={keyword}
        initialLocationBias={locationbias}
        initialFilters={{
          ...(minRating > 0 ? { minRating: String(minRating) } : {}),
          ...(openNow ? { openNow: "1" } : {}),
        }}
      />

      {!keyword && <p className="text-gray-500">キーワードを入力して検索してください。</p>}

      {keyword && filtered.length === 0 && (
        <p className="text-gray-500">
          「{keyword}
          」に一致する候補が見つかりませんでした。条件（地名や表記）を変えてお試しください。
        </p>
      )}

      <div className="grid gap-3">
        {filtered.map((r: any) => {
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
            (locationbias ? `&locationbias=${encodeURIComponent(locationbias)}` : "");

          return (
            <div key={place.place_id ?? place.name} className="space-y-2">
              {/* 結果全体を shrine/places 詳細にリンク（ルーティング仕様に合わせて変えてOK） */}
              {place.place_id ? (
                <a
                  href={`/shrines/resolve?place_id=${place.place_id}`}
                  data-testid="search-result-item"
                  className="block"
                >
                  <PlaceCard p={place} />
                </a>
              ) : (
                <PlaceCard p={place} />
              )}

              <div className="flex gap-2">
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                  >
                    マップで見る（徒歩）
                  </a>
                )}
                <a
                  href={planHref}
                  className="inline-block rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700"
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
