// apps/web/src/lib/concierge/resolvePlace.ts
import { findPlace } from "@/lib/api/places";

export type ResolvePlaceInput = {
  query: string;
  locationbias?: string;
};

export type ResolvePlaceResult = {
  place_id: string;
};

export async function resolvePlace({ query, locationbias }: ResolvePlaceInput): Promise<ResolvePlaceResult | null> {
  const q = (query ?? "").trim();
  if (!q) return null;

  const fp = await findPlace({ input: q, locationbias });

  // findPlace の返却形に揺れがある前提で吸収
  const placeId: string | null =
    (typeof fp?.place_id === "string" && fp.place_id) ||
    (typeof fp?.candidates?.[0]?.place_id === "string" && fp.candidates[0].place_id) ||
    null;

  if (!placeId) return null;

  return { place_id: placeId };
}
