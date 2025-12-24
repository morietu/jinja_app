"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app/error.tsx]", error);
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
