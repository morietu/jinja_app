// apps/web/src/app/concierge/page.tsx
import { Suspense } from "react";
import { redirect } from "next/navigation";
import ConciergeClient from "./ConciergeClient";

type SP = Promise<Record<string, string | string[] | undefined>>;

function pickFirst(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;

  const tid = pickFirst(sp.tid).trim();
  const seed = pickFirst(sp.seed).trim();
  const mode = pickFirst(sp.mode).trim();

  // ✅ 既存スレッド最優先
  if (tid) {
    return (
      <div className="h-full min-h-0">
        <Suspense fallback={<div className="p-4 text-xs text-slate-500">読み込み中…</div>}>
          <ConciergeClient />
        </Suspense>
      </div>
    );
  }

  // ✅ seed が来たら入口 mode=feel に統一（seedをURLに残さない）
  if (seed && mode !== "feel") {
    redirect("/concierge?mode=feel");
  }

  return (
    <div className="h-full min-h-0">
      <Suspense fallback={<div className="p-4 text-xs text-slate-500">読み込み中…</div>}>
        <ConciergeClient />
      </Suspense>
    </div>
  );
}
