// 例: apps/web/src/api/conciergePlan.ts
export type ConciergePlanRequest = {
  message: string;
  lat?: number;
  lng?: number;
  transport?: string;
};

export type ConciergePlanSpot = {
  name: string;
  reason?: string | null;
  place_id?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type ConciergePlanResponse = {
  summary: string;
  spots: ConciergePlanSpot[];
  recommendations: ConciergePlanSpot[];
};

export async function fetchConciergePlan(body: ConciergePlanRequest): Promise<ConciergePlanResponse> {
  const res = await fetch("/api/concierge/plan/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Concierge plan API failed: ${res.status}`);
  }

  return res.json();
}
