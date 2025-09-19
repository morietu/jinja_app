// apps/web/src/lib/conciergeChat.ts
import api from "@/lib/api/client";

type Transport = "walking" | "driving" | "transit";

type Shrine = {
  name: string;
  id?: number | null;
  place_id?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  distance_m: number;
  duration_min: number;
  reason: string;
  photo_url?: string | null;
};

export type Plan = {
  plan_id?: string;
  summary: string;
  shrines: Shrine[];
  tips?: string[];
};

export async function conciergeChat(
  message: string,
  transport: Transport
): Promise<Plan> {
  // 位置情報は取れたら添える（失敗したら undefined のまま）
  let location: { lat: number; lng: number } | undefined;
  try {
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000 })
      );
      location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    }
  } catch {}

  // api クライアントは baseURL=/api に統一済み
  const { data } = await api.post<Plan>("concierge/chat/", {
    message,
    transport,
    location,
  });
  return data;
}
