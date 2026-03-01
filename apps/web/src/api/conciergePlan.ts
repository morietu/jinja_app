// apps/web/src/api/conciergePlan.ts
export type ConciergePlanRequest = {
  query: string;
  language?: string; // "ja"
  transportation?: "walk" | "driving";
  area?: string;

  // 位置系（どれか）
  lat?: number;
  lng?: number;
  radius_m?: number;
  radius_km?: string | number; // serializerが吸ってるなら残してOK
  locationbias?: string; // 受け付けるなら
};

export type ConciergePlanRec = {
  name?: string;
  display_name?: string;
  reason?: string;
  bullets?: string[];
  highlights?: string[];
  display_address?: string;
  location?: { lat?: number; lng?: number } | string | null;
  // 追加フィールドがあっても壊れないように
  [k: string]: unknown;
};

export type ConciergePlanStop = {
  order: number;
  name: string;
  display_address: string;
  location: { lat: number; lng: number };
  eta_minutes: number;
  travel_minutes: number;
  stay_minutes: number;
  [k: string]: unknown;
};

export type ConciergePlanResponse = {
  ok: boolean;
  query: string;
  transportation?: string;
  main?: { location?: { lat: number; lng: number } };
  route_hints?: { mode?: string };
  stops: ConciergePlanStop[];
  data: {
    recommendations: ConciergePlanRec[];
    _explanations?: unknown;
    [k: string]: unknown;
  };
  [k: string]: unknown;
};

export class ConciergePlanError extends Error {
  status?: number;
  code?: string;
  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "ConciergePlanError";
    this.status = status;
    this.code = code;
  }
}

export async function fetchConciergePlan(
  body: ConciergePlanRequest,
  opts?: { signal?: AbortSignal },
): Promise<ConciergePlanResponse> {
  const res = await fetch("/api/concierge/plan/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: opts?.signal,
  });

  // 失敗時もできるだけサーバメッセージを拾う
  if (!res.ok) {
    let msg = `検索に失敗しました (${res.status})`;
    let code: string | undefined;

    try {
      const errJson = await res.json();
      msg = errJson?.detail ?? errJson?.message ?? msg;
      code = errJson?.code;
    } catch {
      // ignore
    }
    throw new ConciergePlanError(msg, res.status, code);
  }

  return (await res.json()) as ConciergePlanResponse;
}
