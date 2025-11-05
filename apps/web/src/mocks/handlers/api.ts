// apps/web/src/mocks/handlers/api.ts
import { http, HttpResponse } from "msw";
import type {
  PopularsResponse,
  NearestResponse,
  ConciergeHistoriesResponse,
  DirectionsResponse,
} from "@/lib/schemas/api";

const base = "/api";

export const apiHandlers = [
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

  // GET /api/shrines/nearest/?lat=...&lng=...&limit=...
  http.get(`${base}/shrines/nearest/`, ({ request }) => {
    const url = new URL(request.url);
    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));
    const limit = Number(url.searchParams.get("limit") ?? 20);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      const empty: NearestResponse = { items: [] };
      return HttpResponse.json(empty, { status: 200 });
    }

    const mock: NearestResponse = {
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
    return HttpResponse.json(mock, { status: 200 });
  }),

  // GET /api/concierges/histories/
  http.get(`${base}/concierges/histories/`, () => {
    const payload: ConciergeHistoriesResponse = {
      items: [
        {
          id: 5001,
          created_at: new Date().toISOString(),
          query: "仕事運・徒歩で20分以内",
          recommendations: [
            {
              id: 11,
              name: "日枝神社",
              lat: 35.6749,
              lng: 139.7414,
              address: "東京都千代田区",
            },
            {
              id: 12,
              name: "烏森神社",
              lat: 35.6646,
              lng: 139.7599,
              address: "東京都港区",
            },
          ],
        },
      ],
    };
    return HttpResponse.json(payload, { status: 200 });
  }),

  // GET /api/directions/?origin=lat,lng&dest=lat,lng&mode=walking|driving
  http.get(`${base}/directions/`, ({ request }) => {
    const url = new URL(request.url);
    const origin = url.searchParams.get("origin") || "";
    const dest = url.searchParams.get("dest") || "";
    const mode =
      (url.searchParams.get("mode") as "walking" | "driving") || "walking";

    const parseLL = (s: string) => s.split(",").map(Number) as [number, number];
    const toRad = (x: number) => (x * Math.PI) / 180;
    const haversine = (
      lat1: number,
      lon1: number,
      lat2: number,
      lon2: number
    ) => {
      const R = 6371000;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Math.max(1, Math.round(R * c));
    };

    let distance = 1850;
    try {
      const [olat, olng] = parseLL(origin);
      const [dlat, dlng] = parseLL(dest);
      if ([olat, olng, dlat, dlng].every((n) => Number.isFinite(n))) {
        distance = haversine(olat, olng, dlat, dlng);
      }
    } catch (_err) {
      void _err; // ignore parse errors -> use fallback
    }

    const duration_min =
      mode === "walking"
        ? Math.round((distance / 80) * 10) / 10
        : Math.round((distance / 500) * 10) / 10;

    const payload: DirectionsResponse = {
      mode,
      distance_m: distance,
      duration_min,
      polyline: "}a~vF|y`uO??_seK`@", // ダミー
    };

    return HttpResponse.json(payload, { status: 200 });
  }),
];


