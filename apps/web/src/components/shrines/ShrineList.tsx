// src/components/shrines/ShrineList.tsx
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
};

export function ShrineList({
  items,
  variant = "list",
  emptyText = "表示できる神社がありません",
  className = "",
}: Props) {
  if (!items || items.length === 0) {
    return <div className={`rounded-xl border p-6 text-sm text-gray-600 ${className}`}>{emptyText}</div>;
  }

  const wrapClass = variant === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" : "flex flex-col gap-3";

  return (
    <div className={`${wrapClass} ${className}`}>
      {items.map(({ id, cardProps }, idx) => {
        const rr = cardProps.recommendReason?.trim();
        const decorated = idx === 0 && rr ? `✨ いちばんおすすめ：${rr}` : (rr ?? undefined);

        return <ShrineCard key={id} {...cardProps} recommendReason={decorated} />;
      })}
    </div>
  );
}
