"use client";

import { labelNeedTag } from "../needTagLabel";

type Props = {
  tags?: string[];
  title?: string;
};

export default function NeedChips({ tags, title = "今回のニーズ" }: Props) {
  const items = (tags ?? []).filter(Boolean).slice(0, 3);
  if (items.length === 0) return null;

  return (
    <div className="mt-2">
      <div className="text-xs text-neutral-500">{title}</div>
      <div className="mt-1 flex flex-wrap gap-2">
        {items.map((t) => (
          <span key={t} className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-xs">
            {labelNeedTag(t)}
          </span>
        ))}
      </div>
    </div>
  );
}
