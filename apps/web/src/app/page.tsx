// apps/web/src/app/page.tsx
import { Suspense } from "react";
import HomePage from "@/features/home/HomePage";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">読み込み中…</div>}>
      <HomePage />
    </Suspense>
  );
}
