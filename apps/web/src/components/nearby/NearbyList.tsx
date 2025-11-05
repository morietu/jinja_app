import * as React from "react";
import { NearbyListItem, ShrineListItem } from "./NearbyList.Item";
import { NearbyListLoading } from "./NearbyList.Loading";
import { NearbyListEmpty } from "./NearbyList.Empty";
import { NearbyListError } from "./NearbyList.Error";

export type NearbyListState = "loading" | "success" | "empty" | "error";

export type NearbyListProps = {
  lat: number;
  lng: number;
  limit?: number;
  state: NearbyListState;
  items?: ShrineListItem[];
  errorMessage?: string;
  onRefetch?: () => void; // 条件変更後の再検索
  onRetry?: () => void; // 失敗からの再試行
  onItemClick?: (id: string) => void;
  className?: string;
  "aria-label"?: string;
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
  ...rest
}: NearbyListProps) {
  // SR向け説明（座標・件数はSRのみ）
  const srLabel = `現在地 緯度${lat.toFixed(4)} 経度${lng.toFixed(
    4
  )}、上限 ${limit} 件`;

  return (
    <section className={className} {...rest}>
      <span className="sr-only">{srLabel}</span>

      {state === "loading" && <NearbyListLoading rows={5} />}

      {state === "error" && (
        <NearbyListError message={errorMessage} onRetry={onRetry} />
      )}

      {state === "empty" && (
        <NearbyListEmpty
          onRefetch={onRefetch}
          suggestion="検索半径を広げるか、キーワードを調整してください。"
        />
      )}

      {state === "success" && (
        <div role="list" aria-label="近隣の神社一覧" className="space-y-3">
          {items.map((s) => (
            <NearbyListItem key={s.id} {...s} onClick={onItemClick} />
          ))}
        </div>
      )}
    </section>
  );
}
