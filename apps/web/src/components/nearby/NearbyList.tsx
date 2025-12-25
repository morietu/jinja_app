import Link from "next/link";
import * as React from "react";
import { NearbyListItem, type ShrineListItem } from "./NearbyList.Item";
import { NearbyListLoading } from "./NearbyList.Loading";
import { NearbyListEmpty } from "./NearbyList.Empty";
import { NearbyListError } from "./NearbyList.Error";

export type NearbyListState = "loading" | "success" | "empty" | "error";

export type NearbyListProps = {
  lat?: number;
  lng?: number;
  limit?: number;
  state: NearbyListState;
  items?: ShrineListItem[];
  errorMessage?: string;
  onRefetch?: () => void;
  onRetry?: () => void;
  onItemClick?: (id: string) => void;
  className?: string;
  "aria-label"?: string;
  itemHref?: (item: ShrineListItem) => string | null;
};

export function NearbyList({
  lat,
  lng,
  limit = 20,
  state,
  items = [],
  errorMessage,
  onRefetch,
  onRetry,
  onItemClick,
  className,
  itemHref,
  ...rest
}: NearbyListProps) {
  const hasCoords = typeof lat === "number" && typeof lng === "number";

  const srLabel = hasCoords
    ? `現在地 緯度${lat!.toFixed(4)} 経度${lng!.toFixed(4)}、上限 ${limit} 件`
    : `現在地の取得前です。上限 ${limit} 件`;

  return (
    <section className={className} {...rest}>
      <span className="sr-only">{srLabel}</span>

      {state === "loading" && <NearbyListLoading rows={5} />}

      {state === "error" && <NearbyListError message={errorMessage} onRetry={onRetry} />}

      {state === "empty" && (
        <NearbyListEmpty onRefetch={onRefetch} suggestion="検索半径を広げるか、キーワードを調整してください。" />
      )}

      {state === "success" && (
        <div role="list" aria-label="近隣の神社一覧" className="space-y-3">
          {items.map((s) => {
            const href = itemHref?.(s) ?? null;

            // id が無い可能性があるなら place_id を fallback
            const key = (s as any).place_id ?? s.id;

            const item = <NearbyListItem {...s} onClick={onItemClick} />;

            return href ? (
              <Link key={key} href={href} className="block">
                {item}
              </Link>
            ) : (
              <div key={key}>{item}</div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export { NearbyListItem } from "./NearbyList.Item";
export { NearbyListLoading } from "./NearbyList.Loading";
export { NearbyListEmpty } from "./NearbyList.Empty";
export { NearbyListError } from "./NearbyList.Error";
