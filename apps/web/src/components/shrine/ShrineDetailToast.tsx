"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { buildShrineHref } from "@/lib/nav/buildShrineHref";


type Props = {
  shrineId: number;
};

export function ShrineDetailToast({ shrineId }: Props) {
  const sp = useSearchParams();
  const router = useRouter();
  const shownRef = useRef(false);

  useEffect(() => {
    const t = sp.get("toast");
    if (t !== "goshuin_saved") return;

    // StrictMode対策：同一マウント中は1回だけ
    if (shownRef.current) return;
    shownRef.current = true;

    // sonner使わないなら alert でOK（今の方針に合わせる）
    alert("御朱印を保存しました");

    // クエリを消しつつアンカーへ（履歴を汚さない）
    router.replace(buildShrineHref(shrineId, { hash: "goshuins" }), { scroll: false });
  }, [sp, router, shrineId]);

  return null;
}
