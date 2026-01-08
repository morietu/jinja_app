"use client";

import { useMemo, useState } from "react";
// ここは HomePage が持ってる型に合わせて import/型調整してOK
type GoshuinItem = {
  id: number;
  image_url?: string | null;
  title?: string | null;
  shrine?: number | null;
  // 必要なら他も
};

type Props = {
  items: GoshuinItem[];
};


export default function PublicGoshuinSection({ items }: Props) {
  // 初期：PC 4 / SP 9 を想定（JSで出し分けが面倒なら「最初から9」で良い）
  const initialCount = 9; // ←まずは固定でOK（最小）
  const [expanded, setExpanded] = useState(false);

  const visible = useMemo(() => {
    const n = expanded ? 9 : initialCount;
    return items.slice(0, n);
  }, [items, expanded]);

  const canExpand = items.length > visible.length;

  return (
    <section id="public-goshuins" className="rounded-2xl border bg-white p-4">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">公開御朱印</h2>
          <p className="text-xs text-slate-500">みんなの公開御朱印</p>
        </div>

        {canExpand && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-xs font-medium text-emerald-700 hover:underline"
          >
            もっと見る
          </button>
        )}
      </header>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {visible.map((g) => (
          <div key={g.id} className="overflow-hidden rounded-xl border bg-white">
            {/* ここは今のカードUIをそのまま移植 */}
            <div className="aspect-[4/5] bg-slate-100" />
            <div className="p-2">
              <p className="truncate text-xs text-slate-700">{g.title ?? "(無題)"}</p>
              <p className="truncate text-[11px] text-slate-500">test</p>
            </div>
          </div>
        ))}
      </div>

      {expanded && (
        <div className="mt-3 text-right">
          <button
            type="button"
            onClick={() => {
              setExpanded(false);
              document.getElementById("public-goshuins")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="text-xs text-slate-500 hover:underline"
          >
            閉じる
          </button>
        </div>
      )}
    </section>
  );
}
