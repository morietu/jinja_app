"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";

export default function HomeLogoLink() {
  const router = useRouter();
  const pathname = usePathname();

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      // ✅ Linkのデフォ遷移は使わない（挙動ブレの元）
      e.preventDefault();
      e.stopPropagation();

      // ✅ まず閉じる（Home埋め込み / Conciergeページ両方で効く）
      window.dispatchEvent(new Event("jinja:close-concierge"));

      // ✅ どこにいてもホームへ（同一URLでも refresh で再評価）
      if (pathname !== "/") {
        router.push("/");
      }
      router.refresh();
    },
    [router, pathname],
  );

  return (
    <Link href="/" onClick={onClick} className="text-base font-bold">
      Jinja
    </Link>
  );
}
