"use client";

import Link from "next/link";
import { useCallback } from "react";
import { EVT_CLOSE_CONCIERGE } from "@/lib/events";

export default function HomeLogoLink() {
  const onClick = useCallback((e: React.MouseEvent) => {
    const path = window.location.pathname;

    // ✅ “実体” で判定する
    if (!path.startsWith("/concierge")) return;

    window.dispatchEvent(new CustomEvent(EVT_CLOSE_CONCIERGE, { detail: { from: "home_logo" } }));
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return (
    <Link href="/" onClick={onClick} className="text-base font-bold">
      Jinja
    </Link>
  );
}
