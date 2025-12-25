// apps/web/src/components/nearby/NearbyList.Item.tsx
import * as React from "react";
import { MapPin, Navigation } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { NearbyItem } from "./types";

const metersToKm = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

export function NearbyListItem(props: NearbyItem) {
  const distanceLabel = typeof props.distance_m === "number" ? metersToKm(props.distance_m) : null;

  return (
    <Card role="listitem" className="rounded-2xl shadow-sm hover:shadow transition">
      <CardContent className="p-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
          <MapPin className="h-5 w-5" aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{props.title}</div>
          {props.subtitle && <div className="text-sm text-muted-foreground truncate">{props.subtitle}</div>}

          {distanceLabel && (
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Navigation className="h-4 w-4" aria-hidden />
              <span>{distanceLabel}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export type { NearbyItem } from "./types";
