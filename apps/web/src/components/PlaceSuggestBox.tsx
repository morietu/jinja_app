"use client";

import { useEffect, useState } from "react";
import { fetchPlaceCaches, type PlaceCacheItem } from "@/lib/api/placeCaches";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSelect: (item: PlaceCacheItem) => void;
};

function useDebouncedValue<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function PlaceSuggestBox({ value, onChange, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PlaceCacheItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);

  const q = value.trim();
  const dq = useDebouncedValue(q, 300);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!open) return;

      if (!dq) {
        setItems([]);
        setEmpty(false);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const data = await fetchPlaceCaches({ q: dq, limit: 10, dedupe: true });
        if (cancelled) return;

        const results = data.results ?? [];
        setItems(results);
        setEmpty(results.length === 0);
      } catch {
        if (cancelled) return;
        setItems([]);
        setEmpty(true);
      } finally {
        // ✅ finally では return しない
        if (!cancelled) setLoading(false);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [dq, open]);

  const showList = open && dq.length > 0;

  return (
    <div className="relative">
      <input
        className="w-full rounded-xl border px-3 py-2"
        value={value}
        placeholder="例：天満宮、稲荷神社、神田明神…"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // クリック選択のために少し猶予
          setTimeout(() => setOpen(false), 120);
        }}
      />

      {showList && (
        <div className="absolute z-10 mt-2 w-full rounded-xl border bg-white shadow">
          {loading && <div className="px-3 py-2 text-sm">検索中…</div>}

          {!loading && empty && <div className="px-3 py-2 text-sm text-gray-600">候補がありません</div>}

          {!loading &&
            items.map((it) => (
              <button
                key={it.place_id}
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-gray-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelect(it)}
              >
                <div className="text-sm font-medium">{it.name}</div>
                <div className="text-xs text-gray-600">{it.address}</div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
