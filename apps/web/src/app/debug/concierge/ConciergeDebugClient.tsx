"use client";

import { useEffect, useMemo, useState } from "react";
import { clearConciergeMetrics, readConciergeMetrics } from "@/lib/log/concierge";

type Metrics = ReturnType<typeof readConciergeMetrics>;

export default function ConciergeDebugClient() {
  // null = 判定中
  const [enabled, setEnabled] = useState<null | boolean>(null);
  const [m, setM] = useState<Metrics>(null);

  // 初回に localStorage を読む（Hookは常に呼ぶ）
  useEffect(() => {
    try {
      setEnabled(localStorage.getItem("debug:concierge") === "1");
    } catch {
      setEnabled(false);
    }
  }, []);

  // enabled のときだけメトリクス更新
  useEffect(() => {
    if (!enabled) return;

    // 初回反映
    setM(readConciergeMetrics());

    const id = window.setInterval(() => {
      setM(readConciergeMetrics());
    }, 1000);

    return () => window.clearInterval(id);
  }, [enabled]);

  if (enabled === null) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-xl font-bold">Concierge Debug</h1>
        <p className="text-sm text-slate-500">判定中…</p>
      </main>
    );
  }

  if (!enabled) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-xl font-bold">Concierge Debug</h1>
        <p className="text-sm text-slate-500">disabled</p>
        <p className="text-xs text-slate-500">有効化: localStorage に debug:concierge = "1"</p>
      </main>
    );
  }

  const attempts = m?.entry.attempts ?? 0;
  const success = m?.entry.success ?? 0;
  const fail = m?.entry.fail ?? 0;
  const pending = m?.entry.pending ?? false;

  const successRate = attempts > 0 ? Math.round((success / attempts) * 100) : 0;
  const failRate = attempts > 0 ? Math.round((fail / attempts) * 100) : 0;

  const threadMissing = m?.counts.thread_missing ?? 0;
  const errors = m?.counts.error ?? 0;
  const unified = m?.counts.unified_received ?? 0;

  const threadMissingRate = unified > 0 ? Math.round((threadMissing / unified) * 100) : 0;
  const errorRate = attempts > 0 ? Math.round((errors / attempts) * 100) : 0;

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-xl font-bold">Concierge Debug</h1>

      <div className="rounded-2xl border bg-white p-4 space-y-2">
        <div className="text-sm font-semibold">入口→推薦</div>
        <div className="text-sm">
          attempts: {attempts} / success: {success} ({successRate}%) / fail: {fail} ({failRate}%) / pending:{" "}
          {String(pending)}
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 space-y-2">
        <div className="text-sm font-semibold">失敗率</div>
        <div className="text-sm">
          thread_missing: {threadMissing} / unified_received: {unified} → {threadMissingRate}%
        </div>
        <div className="text-sm">
          error: {errors} / entry_send: {attempts} → {errorRate}%
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">直近ログ（最大50）</div>
          <button
            type="button"
            className="rounded-full border bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
            onClick={() => {
              clearConciergeMetrics();
              setM(readConciergeMetrics());
            }}
          >
            クリア
          </button>
        </div>

        {m?.logs?.length ? (
          <div className="space-y-2">
            {m.logs.slice(0, 20).map((x, i) => (
              <div key={i} className="rounded-xl border bg-slate-50 px-3 py-2 text-xs">
                <div className="font-semibold">
                  {x.at} / {x.event} / tid={x.tid}
                </div>
                <div className="text-slate-600">{x.path}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">ログがありません（debug:concierge を有効にして操作）</p>
        )}
      </div>

      <div className="rounded-2xl border bg-white p-4">
        <p className="text-xs text-slate-500">
          有効化: localStorage に debug:concierge = "1"（本番でも端末だけON可）。
        </p>
      </div>
    </main>
  );
}
