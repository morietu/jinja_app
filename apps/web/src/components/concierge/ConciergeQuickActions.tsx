"use client";

import { useRouter } from "next/navigation";

type Props = {
  variant?: "full" | "compact";
};

export function ConciergeQuickActions({ variant = "full" }: Props) {
  const router = useRouter();

  const base = "flex flex-col items-center justify-center rounded-2xl border px-4 py-3 text-sm";

  return (
    <div className={variant === "full" ? "mt-6 grid grid-cols-3 gap-4" : "mt-4 flex gap-4 justify-center"}>
      <button className={base} onClick={() => router.push("/map")}>
        <span className="text-xs text-gray-500">地図</span>
        <span className="mt-1 font-medium">地図で見る</span>
      </button>

      <button className={base} onClick={() => router.push("/me")}>
        <span className="text-xs text-gray-500">マイページ</span>
        <span className="mt-1 font-medium">お気に入り・診断</span>
      </button>

      <button className={base} onClick={() => router.push("/settings/history")}>
        <span className="text-xs text-gray-500">履歴</span>
        <span className="mt-1 font-medium">履歴・設定</span>
      </button>
    </div>
  );
}
