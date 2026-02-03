"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

export function HeaderAuthButtons() {
  const { isLoggedIn } = useAuth();

  const pathname = usePathname();
  const sp = useSearchParams();

  const loginHref = useMemo(() => {
    const current = pathname + (sp?.toString() ? `?${sp.toString()}` : "");
    return `/login?next=${encodeURIComponent(current)}`;
  }, [pathname, sp]);

  const goshuinBookHref = "/mypage?tab=goshuin";

  return (
    <div className="flex items-center gap-2">
      <Link href={goshuinBookHref} className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white">
        御朱印帳
      </Link>

      {!isLoggedIn && (
        <Link href={loginHref} className="rounded-md bg-orange-500 px-3 py-2 text-xs font-medium text-white">
          ログイン
        </Link>
      )}
    </div>
  );
}
