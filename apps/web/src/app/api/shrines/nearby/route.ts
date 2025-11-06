// apps/web/src/app/api/shrines/nearby/route.ts
import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    results: [
      { id: "s1", name: "日枝神社", lat: 35.67, lng: 139.74, distance_m: 120 },
      {
        id: "s2",
        name: "赤坂氷川神社",
        lat: 35.66,
        lng: 139.73,
        distance_m: 420,
      },
    ],
  });
}
