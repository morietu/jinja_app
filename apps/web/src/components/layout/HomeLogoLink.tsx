"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback } from "react";

export default function HomeLogoLink() {
  const pathname = usePathname();

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      if (!pathname.startsWith("/concierge")) return; // concierge 外は何もしない
      window.dispatchEvent(new Event("jinja:close-concierge"));
      e.preventDefault();
      e.stopPropagation();
    },
    [pathname],
  );

  return (
    <Link href="/" onClick={onClick} className="text-base font-bold">
      Jinja
    </Link>
  );
}
