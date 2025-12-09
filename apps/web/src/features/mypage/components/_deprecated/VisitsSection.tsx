// apps/web/src/features/mypage/components/VisitsSection.tsx
"use client";

import Link from "next/link";

export default function VisitsSection() {
  // TODO: 後で useVisitHistory() に差し替え
  const loading = false;
  const error: string | null = null;
  const items: { id: number; shrineName: string; visitedAt: string }[] = [];

  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm">
      <header className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">参拝履歴</h2>
        <Link href="/routes" className="text-[11px] text-emerald-700 underline">
          一覧へ
        </Link>
      </header>

      {loading && <p className="text-xs text-gray-500">読み込み中です…</p>}
      {error && <p className="text-xs text-red-600">参拝履歴の取得に失敗しました。</p>}

      {!loading && !error && items.length === 0 && (
        <p className="text-xs text-gray-500">まだ参拝履歴が記録されていません。</p>
      )}

      {!loading && !error && items.length > 0 && (
        <ul className="space-y-2 text-xs">
          {items.slice(0, 5).map((v) => (
            <li key={v.id} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{v.shrineName}</p>
                <p className="text-[11px] text-gray-500">{new Date(v.visitedAt).toLocaleDateString("ja-JP")}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
