"use client";

import { useState } from "react";
import { resolvePlace } from "@/lib/api/places";
import { createFavoriteByShrineId } from "@/lib/api/favorites";
import { buildShrineHref } from "@/lib/nav/buildShrineHref";
import { buildLoginHref } from "@/lib/nav/login";

export default function PlaceCardClientActions({
  placeId,
  alreadyImported,
}: {
  placeId: string;
  alreadyImported: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (alreadyImported) {
    return <span className="text-xs text-gray-500">登録済み</span>;
  }

  const onImport = async () => {
    try {
      setBusy(true);
      setErr(null);

      const r = await resolvePlace(placeId);
      const shrineId = Number((r as any)?.shrine_id ?? (r as any)?.id ?? NaN);
      if (!Number.isFinite(shrineId) || shrineId <= 0) throw new Error("resolve_no_shrine_id");

      await createFavoriteByShrineId(shrineId);

      window.location.assign(buildShrineHref(shrineId));
    } catch (e: any) {
      const status = e?.response?.status ?? e?.status;

      if (status === 401) {
        const current = `${window.location.pathname}${window.location.search}`;
        window.location.assign(buildLoginHref(current));
        return;
      }

      setErr("登録に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={onImport}
        disabled={busy}
        className="text-sm px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? "登録中…" : "＋登録"}
      </button>
      {err && <span className="text-xs text-red-600 ml-2">{err}</span>}
    </>
  );
}
