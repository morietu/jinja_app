// apps/web/src/app/error.tsx
"use client";

import { useEffect } from "react";
import { clientLog } from "@/lib/client/logging";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    clientLog("error", "APP_ERROR_BOUNDARY", {
      message: error.message,
      digest: error.digest ?? null,
      // stack は環境で出たり出なかったりするけど、取れるなら便利
      stack: error.stack ?? null,
    });
  }, [error]);

  return (
    <main className="mx-auto max-w-md p-6 space-y-3">
      <h1 className="text-lg font-bold">エラーが発生しました</h1>
      <pre className="text-xs whitespace-pre-wrap rounded-xl border bg-white p-3">
        {error.message}
        {error.digest ? `\n\ndigest: ${error.digest}` : ""}
      </pre>
      <button className="rounded-md bg-slate-900 px-3 py-2 text-xs text-white" onClick={() => reset()}>
        再試行
      </button>
    </main>
  );
}
