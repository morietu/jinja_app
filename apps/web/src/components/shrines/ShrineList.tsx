import React from "react";
import { ShrineCard, type ShrineCardProps } from "./ShrineCard";

export type ShrineListItem = {
  id: string;
  cardProps: ShrineCardProps;
};

type Props = {
  items: ShrineListItem[];
  variant?: "list" | "grid";
  emptyText?: string;
  className?: string;
  headerMessage?: string | null;
  notice?: string | null;
};

export function ShrineList({
  items,
  variant = "list",
  emptyText = "表示できる神社がありません",
  className = "",
  headerMessage,
  notice,
}: Props) {
  if (!items || items.length === 0) {
    return <div className={`rounded-xl border p-6 text-sm text-gray-600 ${className}`}>{emptyText}</div>;
  }

  const wrapClass = variant === "grid" ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-3";

  return (
    <div className={className}>
      {headerMessage ? <div className="mb-3 text-sm text-gray-700">{headerMessage}</div> : null}

      {notice ? (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {notice}
        </div>
      ) : null}

      <div className={wrapClass}>
        {items.map(({ id, cardProps }, idx) => {
          return <ShrineCard key={id} {...cardProps} isTopPick={idx === 0} />;
        })}
      </div>
    </div>
  );
}
