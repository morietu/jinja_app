"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";

export default function HomeLogoLink() {
  const router = useRouter();
  const pathname = usePathname();

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // concierge を閉じる（concierge側が / へ戻す）
      window.dispatchEvent(new Event("jinja:close-concierge"));

      // concierge 以外にいる時だけ自分で戻す
      if (!pathname.startsWith("/concierge")) {
        router.push("/");
      }
    },
    [router, pathname],
  );

  return (
    <Link href="/" onClick={onClick} className="text-base font-bold">
      Jinja
    </Link>
  );
}
