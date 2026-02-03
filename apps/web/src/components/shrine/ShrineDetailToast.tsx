// apps/web/src/components/shrine/ShrineDetailToast.tsx
"use client";

import { useEffect, useRef } from "react";
import { buildShrineHref } from "@/lib/nav/buildShrineHref";

type Props = { shrineId: number };

export function ShrineDetailToast({ shrineId }: Props) {
  const shownRef = useRef(false);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const t = sp.get("toast");
    if (t !== "goshuin_saved") return;

    if (shownRef.current) return;
    shownRef.current = true;

    alert("御朱印を保存しました");

    // toast クエリを消して #goshuins に寄せる（履歴を汚さない）
    const href = buildShrineHref(shrineId, { hash: "goshuins" });
    const u = new URL(href, window.location.origin);
    window.history.replaceState(null, "", `${u.pathname}${u.search}${u.hash}`);

    // hashだけだと環境によってはスクロールが安定しないので保険
    requestAnimationFrame(() => {
      document.getElementById("goshuins")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [shrineId]);

  return null;
}
