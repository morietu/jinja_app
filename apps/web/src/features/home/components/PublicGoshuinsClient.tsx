// apps/web/src/features/home/components/PublicGoshuinsClient.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";


type Goshuin = {
  id: number;
  shrine?: number;
  title?: string | null;
  image_url?: string | null;
  shrine_name?: string | null;
};

type Props = {
  results: Goshuin[]; // ここに最大9件が入ってくる想定
};

function PublicGoshuinCard({ g }: { g: Goshuin }) {
  const href = g.shrine ? `/shrines/${g.shrine}` : "/";

  return (
    <Link href={href} className="block overflow-hidden rounded-2xl border bg-white shadow-sm hover:opacity-95">
      <div className="relative aspect-[4/5] bg-slate-100">
        {g.image_url ? (
          <Image
            src={g.image_url}
            alt={g.title ?? "御朱印"}
            width={800}
            height={1000}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
    </Link>
  );
}

export function PublicGoshuinsClient({ results }: Props) {
  const [expanded, setExpanded] = useState(false);

  const initial = results.slice(0, 4); // PC用に4
  const expandedList = results.slice(0, 9);

  return (
    <section id="public-goshuins">
      <header className="mb-3 flex items-end justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">公開御朱印</h3>
        </div>

        {expanded ? (
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
        ) : (
          <button type="button" onClick={() => setExpanded(true)} className="text-xs text-emerald-700 hover:underline">
            もっと見る
          </button>
        )}
      </header>

      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
        {!expanded ? (
          <>
            {/* SP: 3枚 */}
            {initial.slice(0, 3).map((g) => (
              <PublicGoshuinCard key={g.id} g={g} />
            ))}

            {/* PCだけ 4枚目（sm以上で表示） */}
            {initial[3] ? (
              <div className="hidden sm:block">
                <PublicGoshuinCard g={initial[3]} />
              </div>
            ) : null}
          </>
        ) : (
          expandedList.map((g) => <PublicGoshuinCard key={g.id} g={g} />)
        )}
      </div>
    </section>
  );
}
