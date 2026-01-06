// apps/web/src/app/concierge/page.tsx
import { Suspense } from "react";
import ConciergeClient from "./ConciergeClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4 text-xs text-slate-500">読み込み中…</div>}>
      <ConciergeClient />
    </Suspense>
  );
}
