// apps/web/src/features/home/components/HomeGoshuinFeedSection.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type FeedItem = {
  id: number;
  shrine: number;
  shrine_name?: string | null;
  title?: string | null;
  image_url?: string | null;
  created_at?: string;
};

type State = { kind: "loading" } | { kind: "success"; items: FeedItem[] } | { kind: "empty" } | { kind: "error" };

export default function HomeGoshuinFeedSection({ limit = 12 }: { limit?: number }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    setState({ kind: "loading" });

    (async () => {
      try {
        const r = await fetch(`/api/public/goshuins/feed?limit=${limit}`, { cache: "no-store" });
        if (!r.ok) throw new Error("feed fetch failed");

        const json = (await r.json()) as FeedItem[];

        if (!alive) return;

        const items = Array.isArray(json)
          ? json.filter((x) => Number.isFinite(x?.id) && Number.isFinite(x?.shrine) && x?.image_url)
          : [];

        if (items.length === 0) setState({ kind: "empty" });
        else setState({ kind: "success", items });
      } catch {
        if (!alive) return;
        setState({ kind: "error" });
      }
    })();

    return () => {
      alive = false;
    };
  }, [limit]);

  const content = useMemo(() => {
    if (state.kind === "loading") {
      return (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-lg bg-slate-100" />
          ))}
        </div>
      );
    }

    if (state.kind === "empty") {
      return (
        <div className="rounded-xl border bg-white p-3 text-xs text-slate-600">
          まだ公開御朱印がありません
          <div className="mt-2 grid grid-cols-3 gap-2 opacity-40">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-lg bg-slate-100" />
            ))}
          </div>
        </div>
      );
    }

    if (state.kind === "error") {
      return (
        <div className="rounded-xl border bg-white p-3 text-xs text-slate-600">
          現在、最新の公開御朱印を表示できません
          <div className="mt-2 grid grid-cols-3 gap-2 opacity-40">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-lg bg-slate-100" />
            ))}
          </div>
        </div>
      );
    }

    // success
    const items = state.items;
    const show = items.slice(0, Math.min(12, limit));
    const need = Math.max(0, 3 - show.length);


    return (
      <div className="grid grid-cols-3 gap-2">
        {show.map((g) => (
          <Link
            key={g.id}
            href={`/shrines/${g.shrine}`}
            className="group block overflow-hidden rounded-lg border bg-white"
          >
            <div className="aspect-square bg-slate-50">
              <img
                src={g.image_url ?? ""}
                alt={g.title ?? g.shrine_name ?? "御朱印"}
                className="h-full w-full object-cover transition-opacity group-hover:opacity-90"
                loading="lazy"
              />
            </div>
          </Link>
        ))}
        {/* ✅ 足りない分は薄いプレースホルダで埋める */}
        {Array.from({ length: need }).map((_, i) => (
          <div key={`ph-${i}`} className="aspect-square rounded-lg border bg-white">
            <div className="h-full w-full bg-slate-50" />
          </div>
        ))}
      </div>
    );
  }, [state, limit]);

  return (
    <section className="space-y-2">
      <div className="px-1">
        <div className="text-sm font-semibold text-slate-800">最新の公開御朱印</div>
        <div className="text-xs text-slate-500">タップで神社詳細へ</div>
      </div>
      {content}
    </section>
  );
}
