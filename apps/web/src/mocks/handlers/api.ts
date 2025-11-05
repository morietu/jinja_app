// apps/web/src/mocks/handlers/api.ts
import type { PopularsResponse, NearestResponse } from "@/lib/schemas/api";

const base = "/api";

export const placesHandlers = [
  http.get("/api/places/nearby", ({ request }) => {
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode");
    if (mode === "error")
      return HttpResponse.json({ message: "boom" }, { status: 500 });
    if (mode === "empty") return HttpResponse.json([]);
    return HttpResponse.json([
      { id: "1", name: "明治神宮", distance_meters: 850, duration_minutes: 12 },
      {
        id: "2",
        name: "神田明神",
        distance_meters: 2300,
        duration_minutes: 28,
      },
    ]);
  }),
];

const coreHandlers = [
  // GET /api/populars/
  http.get(`${base}/populars/`, () => {
    const payload: PopularsResponse = {
      items: [
        {
          shrine: {
            id: 1,
            name: "明治神宮",
            lat: 35.6764,
            lng: 139.6993,
            address: "東京都渋谷区",
          },
          score: 91.2,
          period_days: 30,
        },
        {
          shrine: {
            id: 2,
            name: "神田明神",
            lat: 35.7023,
            lng: 139.767,
            address: "東京都千代田区",
          },
          score: 88.5,
          period_days: 30,
        },
      ],
    };
    return HttpResponse.json(payload, { status: 200 });
  }),

  // GET /api/shrines/nearest/
  http.get(`${base}/shrines/nearest/`, ({ request }) => {
    const url = new URL(request.url);
    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));
    const limit = Number(url.searchParams.get("limit") ?? 20);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      const empty: NearestResponse = { items: [] };
      return HttpResponse.json(empty, { status: 200 });
    }

    const payload: NearestResponse = {
      items: Array.from({ length: Math.min(limit, 3) }).map((_, i) => ({
        shrine: {
          id: 100 + i,
          name: `近隣の神社 ${i + 1}`,
          lat: lat + 0.001 * i,
          lng: lng + 0.001 * i,
          address: null,
        },
        distance_m: 350 * (i + 1),
        walking_minutes: 5 * (i + 1),
        driving_minutes: 2 * (i + 1),
      })),
    };
    return HttpResponse.json(payload, { status: 200 });
  }),

  // ほか既存: /concierges/histories/, /directions/ ...
  // （ユーザー提示コードそのまま）
];

// 単一の export にまとめる
export const apiHandlers = [...placesHandlers, ...coreHandlers];
