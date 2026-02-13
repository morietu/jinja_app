"use client";

import { useEffect, useState } from "react";
import type { Shrine } from "@/lib/api/shrines";
import { fetchPlaceCacheSuggest } from "@/lib/api/placeCaches";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSelect: (it: Shrine) => void;
  limit?: number;
};

export function PlaceSuggestBox({ value, onChange, onSelect, limit = 10 }: Props) {
  const [debounced, setDebounced] = useState(value);
  const [items, setItems] = useState<Shrine[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value.trim()), 300);
    return () => window.clearTimeout(id);
  }, [value]);

  useEffect(() => {
    if (!debounced) {
      setItems([]);
      return;
    }
    if (debounced.length < 2) {
      setItems([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await fetchPlaceCacheSuggest(debounced, limit);
        if (!cancelled) setItems(res);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debounced, limit]);

  return (
    <div className="space-y-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="神社名で検索"
        className="w-full rounded-xl border px-3 py-2 text-sm"
      />

      {loading ? <div className="text-xs text-slate-500">検索中…</div> : null}

      {items.length ? (
        <div className="rounded-xl border bg-white">
          {items.map((s) => {
            const key = String((s as any).id ?? s.name_jp ?? "");
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelect(s)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <div className="font-semibold">{s.name_jp}</div>
                {"address" in s && (s as any).address ? (
                  <div className="mt-1 text-xs text-slate-500">{(s as any).address}</div>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
