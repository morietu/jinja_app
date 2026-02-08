"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchPlaceCacheSuggest, PlaceCacheItem } from "@/lib/api/placeCaches";

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export default function PlaceSuggestBox() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q.trim(), 250);

  const [items, setItems] = useState<PlaceCacheItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const activeReq = useRef(0);

  useEffect(() => {
    setErr(null);

    if (dq.length < 2) {
      setItems([]);
      return;
    }

    const reqId = ++activeReq.current;
    setLoading(true);

    fetchPlaceCacheSuggest(dq, 10)
      .then((res) => {
        if (reqId !== activeReq.current) return;
        setItems(res);
      })
      .catch((e) => {
        if (reqId !== activeReq.current) return;
        setErr(e?.message ?? "failed");
        setItems([]);
      })
      .finally(() => {
        if (reqId !== activeReq.current) return;
        setLoading(false);
      });
  }, [dq]);

  const showDropdown = useMemo(() => dq.length >= 2 && (loading || err || items.length > 0), [dq, loading, err, items]);

  return (
    <div className="relative w-full max-w-xl">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="例：天満宮、稲荷、神田明神…"
        className="w-full rounded-xl border px-4 py-3 text-base"
      />

      {showDropdown && (
        <div className="absolute z-10 mt-2 w-full rounded-xl border bg-white shadow">
          {loading && <div className="px-4 py-3 text-sm">検索中…</div>}
          {err && <div className="px-4 py-3 text-sm text-red-600">エラー: {err}</div>}

          {!loading && !err && items.length === 0 && <div className="px-4 py-3 text-sm">候補なし</div>}

          {!loading &&
            !err &&
            items.map((it) => (
              <button
                key={it.place_id}
                className="block w-full px-4 py-3 text-left hover:bg-gray-50"
                onClick={() => {
                  // detail ページに飛ばす（このパスはあなたのアプリに合わせて変更）
                  router.push(`/places/${encodeURIComponent(it.place_id)}`);
                }}
              >
                <div className="text-sm font-medium">{it.name}</div>
                <div className="text-xs text-gray-500">{it.address}</div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
