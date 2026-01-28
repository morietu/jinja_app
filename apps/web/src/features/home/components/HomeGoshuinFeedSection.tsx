"use client";
// NOTE:
// このコンポーネントは「公開情報の閲覧専用」
// 認証状態・owner・公開切替ロジックは一切扱わない

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

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

    (async () => {
      setState({ kind: "loading" });
      try {
        const r = await fetch(`/api/public/goshuins/feed?limit=${limit}`, { cache: "no-store" });
        if (!r.ok) throw new Error("feed fetch failed");

        const json: unknown = await r.json();
        if (!alive) return;

        const raw: any[] = Array.isArray(json)
          ? json
          : Array.isArray((json as any)?.results)
            ? (json as any).results
            : [];

        const items: FeedItem[] = raw
          .filter((x: any) => Number.isFinite(x?.id) && Number.isFinite(x?.shrine) && x?.image_url)
          .map((x: any) => ({
            id: Number(x.id),
            shrine: Number(x.shrine),
            shrine_name: x.shrine_name ?? null,
            title: x.title ?? null,
            image_url: x.image_url ?? null,
            created_at: x.created_at,
          }));

        if (!alive) return;

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

    const items = state.items;
    const show = items.slice(0, Math.min(12, limit));
    const need = Math.max(0, 3 - show.length);

    return (
      <div className="grid grid-cols-3 gap-2">
        {show.map((g: FeedItem) => (
          <Link
            key={g.id}
            href={`/shrines/${g.shrine}`}
            className="group block overflow-hidden rounded-lg border bg-white"
          >
            <div className="aspect-square bg-slate-50 relative overflow-hidden">
              <Image
                src={g.image_url ?? ""}
                alt={g.title ?? g.shrine_name ?? "御朱印"}
                fill
                sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 200px"
                className="object-cover transition-opacity group-hover:opacity-90"
                unoptimized
              />
            </div>
          </Link>
        ))}

        {Array.from({ length: need }).map((_, i) => (
          <div key={`ph-${i}`} className="aspect-square rounded-lg border bg-white">
            <div className="h-full w-full bg-slate-50" />
          </div>
        ))}
      </div>
    );
  }, [state, limit]);

  return <section className="space-y-2">{content}</section>;
}
