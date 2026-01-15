"use client";

import { labelNeedTag } from "../needTagLabel";

type Props = {
  matched?: string[];
};

export default function MatchChips({ matched }: Props) {
  const items = (matched ?? []).filter(Boolean);
  if (items.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((t) => (
        <span key={t} className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-700">
          一致: {labelNeedTag(t)}
        </span>
      ))}
    </div>
  );
}
