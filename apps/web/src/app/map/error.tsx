// apps/web/src/app/map/error.tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { clientLog } from "@/lib/client/logging";

export default function MapError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    clientLog("error", "MAP_ERROR_BOUNDARY", {
      message: error.message,
      digest: error.digest ?? null,
      stack: error.stack ?? null,
    });
  }, [error]);

  return (
    <main className="p-4 max-w-md mx-auto space-y-4">
      <h1 className="text-lg font-bold">地図を読み込めませんでした</h1>
      <p className="text-sm text-gray-700">
        神社一覧または地図の読み込み中にエラーが発生しました。 ネットワークや API
        の状態を確認してから、再試行してください。
      </p>

      <div className="space-y-2">
        <button
          type="button"
          onClick={reset}
          className="w-full rounded-full bg-black px-4 py-2 text-sm font-medium text-white"
        >
          もう一度読み込む
        </button>
        <Link
          href="/"
          className="block w-full rounded-full border border-gray-300 px-4 py-2 text-center text-sm text-gray-800 hover:bg-gray-50"
        >
          トップに戻る
        </Link>
      </div>
    </main>
  );
}
