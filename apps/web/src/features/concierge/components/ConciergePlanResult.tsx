// src/features/concierge/components/ConciergePlanResult.tsx
"use client";

import type { ConciergePlanResponse } from "@/api/conciergePlan";

type Props = {
  plan: ConciergePlanResponse | null;
  loading: boolean;
  error: string | null;
};

export function ConciergePlanResult({ plan, loading, error }: Props) {
  if (loading) {
    return <div className="rounded border p-3 text-sm bg-white">参拝プランを作成中です…</div>;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!plan) {
    return null;
  }

  return (
    <div className="rounded border p-3 text-sm bg-white space-y-2">
      <div className="font-semibold mb-1">参拝プラン</div>

      {plan.summary && <p className="mb-2">{plan.summary}</p>}

      <ul className="space-y-2">
        {plan.spots.map((spot, idx) => (
          <li key={spot.place_id ?? idx} className="border rounded p-2">
            <div className="font-semibold">{spot.name}</div>
            {spot.reason && <div className="text-xs text-slate-700 mt-1">{spot.reason}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
