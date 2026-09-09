"use client";

import { useEffect, useState } from "react";

import type { PopularShrineRow, PopularShrinesResponseBody } from "./types";

function labelFor(s: PopularShrineRow): string {
  return (s.name_jp ?? "").trim() || "（名称不明）";
}

function normalizeRows(body: PopularShrinesResponseBody): PopularShrineRow[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>;
    const fromResults = rec.results;
    if (Array.isArray(fromResults)) return fromResults as PopularShrineRow[];
    const fromItems = rec.items;
    if (Array.isArray(fromItems)) return fromItems as PopularShrineRow[];
  }
  return [];
}

function errorMessage(e: unknown): string {
  if (e instanceof DOMException && e.name === "AbortError") return "";
  if (e instanceof Error) return e.message;
  return typeof e === "string" ? e : "不明なエラーが発生しました";
}

export default function PopularShrinesListPage() {
  const [items, setItems] = useState<PopularShrineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    const { signal } = ac;

    setLoading(true);
    setError(null);
    setItems([]);

    const sp = new URLSearchParams();
    sp.set("limit", "50");

    fetch(`/api/populars/?${sp.toString()}`, { cache: "no-store", signal })
      .then(async (res) => {
        if (!res.ok) {
          const rawText = await res.text();
          let detail = rawText.slice(0, 500);
          try {
            const j = JSON.parse(rawText) as Record<string, unknown>;
            if (typeof j.error === "string") detail = j.error;
            else if (typeof j.body === "string") detail = j.body.slice(0, 500);
          } catch {
            /* プレーンテキストのまま */
          }
          throw new Error(`取得に失敗しました（HTTP ${res.status}）${detail ? `: ${detail}` : ""}`);
        }
        try {
          return (await res.json()) as PopularShrinesResponseBody;
        } catch {
          throw new Error("レスポンスの JSON が不正です");
        }
      })
      .then((body) => {
        if (signal.aborted) return;
        setItems(normalizeRows(body));
      })
      .catch((e: unknown) => {
        if (signal.aborted || (e instanceof DOMException && e.name === "AbortError")) return;
        const msg = errorMessage(e);
        if (msg) setError(msg);
      })
      .finally(() => {
        if (signal.aborted) return;
        setLoading(false);
      });

    return () => {
      ac.abort();
    };
  }, []);

  return (
    <main className="mx-auto max-w-lg p-4">
      <h1 className="mb-4 text-lg font-semibold">人気神社一覧</h1>

      {loading && <p className="text-sm text-[var(--kt-color-text-secondary)]">読み込み中です…</p>}

      {error && !loading && (
        <div
          role="alert"
          className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900"
        >
          <p className="font-medium">エラー</p>
          <p className="mt-2 whitespace-pre-wrap break-words">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {items.length === 0 ? (
            <li className="list-none pl-0 text-[var(--kt-color-text-secondary)]">表示できる神社がありません。</li>
          ) : (
            items.map((s) => <li key={s.id}>{labelFor(s)}</li>)
          )}
        </ul>
      )}
    </main>
  );
}
