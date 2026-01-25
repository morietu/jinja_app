// apps/web/src/features/home/HomePage.tsx


import { Suspense } from "react";
import { HomeToastClient } from "@/features/home/components/HomeToastClient";
import { HomeMainClient } from "@/features/home/components/HomeMainClient";

export default function HomePage() {
  return (
    <div className="min-h-0 bg-slate-50">
      <HomeToastClient />

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8">
        <Suspense fallback={null}>
          <HomeMainClient />
        </Suspense>
      </div>
    </div>
  );
}
// HomePage (Server Component)
// - データ取得や状態管理はしない
// - HomeMainClient 等の Client を並べるだけ
