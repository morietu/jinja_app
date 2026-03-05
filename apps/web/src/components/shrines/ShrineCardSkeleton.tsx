// src/components/shrines/ShrineCardSkeleton.tsx
import * as React from "react";

type Props = {
  className?: string;
};

export function ShrineCardSkeleton({ className = "" }: Props) {
  return (
    <div className={`rounded-xl border p-4 flex gap-4 ${className}`}>
      <div className="w-28 h-20 rounded-lg bg-gray-100 overflow-hidden shrink-0">
        <div className="w-full h-full bg-gray-200 animate-pulse" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
            <div className="mt-2 h-3 w-56 bg-gray-200 rounded animate-pulse" />
          </div>

          <div className="shrink-0">
            <div className="h-7 w-10 bg-gray-200 rounded-md animate-pulse" />
          </div>
        </div>

        <div className="mt-3 flex gap-3">
          <div className="h-3 w-12 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <div className="h-6 w-14 bg-gray-200 rounded-full animate-pulse" />
          <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse" />
          <div className="h-6 w-12 bg-gray-200 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}
