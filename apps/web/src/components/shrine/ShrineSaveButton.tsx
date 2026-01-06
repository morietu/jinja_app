// apps/web/src/components/shrine/ShrineSaveButton.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFavorite } from "@/hooks/useFavorite";

type Props = {
  shrineId: number;
  nextPath?: string; // 未ログイン時の戻り先
};

export default function ShrineSaveButton({ shrineId, nextPath }: Props) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);

  const { fav, busy, toggle } = useFavorite({
    shrineId,
  });

  const onClick = async () => {
    setErr(null);
    try {
      await toggle();
    } catch (e: any) {
      // 401っぽい時はログインへ誘導（API実装により形は変わるので保険的に）
      const status = e?.response?.status ?? e?.status;
      if (status === 401) {
        const next = nextPath ?? `/shrines/${shrineId}`;
        router.push(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      setErr("保存の更新に失敗しました");
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className={`inline-flex w-full items-center justify-center rounded-xl border px-4 py-3 text-sm font-semibold transition
          ${fav ? "border-amber-300 bg-amber-50" : "bg-white hover:bg-gray-50"}
          disabled:opacity-60`}
        aria-pressed={fav}
      >
        {busy ? "…" : fav ? "保存済み" : "保存"}
      </button>

      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}
