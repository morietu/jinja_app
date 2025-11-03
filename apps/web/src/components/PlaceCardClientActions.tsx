// apps/web/src/components/PlaceCardClientActions.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { importFromPlace } from "@/lib/api/shrines"; // ← api/shrines からでOK

export default function PlaceCardClientActions({
  placeId,
  alreadyImported,
}: {
  placeId: string;
  alreadyImported: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (alreadyImported) {
    return <span className="text-xs text-gray-500">登録済み</span>;
  }

  const onImport = async () => {
    try {
      setBusy(true);
      setErr(null);
      const shrine = await importFromPlace(placeId);
      const shrineId = (shrine as any)?.id ?? (shrine as any)?.pk ?? null;
      if (shrineId) router.push(`/shrines/${shrineId}`);
    } catch (e: any) {
      setErr(
        e?.response?.status === 401
          ? "ログインが必要です"
          : "登録に失敗しました"
      );
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
