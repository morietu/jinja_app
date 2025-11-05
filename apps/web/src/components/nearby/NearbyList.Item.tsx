import { MapPin, Navigation } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export type ShrineListItem = {
  id: string;
  name: string;
  address?: string;
  distanceMeters: number; // サーバーからの生値を想定
  durationMinutes?: number; // 経路APIがあれば任意
  onClick?: (id: string) => void;
};

const metersToKm = (m: number) =>
  m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;

const minutesToReadable = (min?: number) =>
  typeof min === "number" ? `${Math.max(1, Math.round(min))} 分` : "—";

export function NearbyListItem(props: ShrineListItem) {
  const { id, name, address, distanceMeters, durationMinutes, onClick } = props;

  return (
    <Card
      role="listitem"
      tabIndex={0}
      aria-label={`${name}、距離 ${metersToKm(
        distanceMeters
      )}、所要 ${minutesToReadable(durationMinutes)}`}
      className="cursor-pointer rounded-2xl shadow-sm hover:shadow transition"
      onClick={() => onClick?.(id)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick?.(id)}
    >
      <CardContent className="p-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
          <MapPin className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{name}</div>
          {address && (
            <div className="text-sm text-muted-foreground truncate">
              {address}
            </div>
          )}
          <div className="mt-1 flex items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1">
              <Navigation className="h-4 w-4" aria-hidden />{" "}
              {metersToKm(distanceMeters)}
            </span>
            <span aria-label="徒歩所要時間">
              所要 {minutesToReadable(durationMinutes)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
