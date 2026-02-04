"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";

export function HeaderAuthButtons() {
  const { isLoggedIn } = useAuth();

  const goshuinBookHref = "/mypage?tab=goshuin";

  const goLogin = () => {
    const current = window.location.pathname + window.location.search;
    window.location.assign(`/login?next=${encodeURIComponent(current)}`);
  };

  return (
    <div className="flex items-center gap-2">
      <Link href={goshuinBookHref} className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white">
        御朱印帳
      </Link>

      {!isLoggedIn && (
        <button
          type="button"
          onClick={goLogin}
          className="rounded-md bg-orange-500 px-3 py-2 text-xs font-medium text-white"
        >
          ログイン
        </button>
      )}
    </div>
  );
}
