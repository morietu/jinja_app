// apps/web/src/app/concierge/page.tsx
import { Suspense } from "react";
import ConciergeClientFull from "./ConciergeClientFull";

function Fallback() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="rounded-2xl border bg-white p-4 text-sm text-slate-600">読み込み中…</div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Fallback />}>
      <ConciergeClientFull />
    </Suspense>
  );
}
