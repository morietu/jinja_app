"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

export function HeaderAuthButtons() {
  const { isLoggedIn } = useAuth();
  const router = useRouter();

  const goshuinBookHref = "/mypage?tab=goshuin";

  const onLoginClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // hydration後だけ効く。hydration前は普通に /login へ飛ぶ（保険）
    e.preventDefault();
    const current = window.location.pathname + window.location.search;
    router.push(`/login?next=${encodeURIComponent(current)}`);
  };

  return (
    <div className="flex items-center gap-2">
      <Link href={goshuinBookHref} className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white">
        御朱印帳
      </Link>

      {!isLoggedIn && (
        <Link
          href="/login"
          onClick={onLoginClick}
          className="rounded-md bg-orange-500 px-3 py-2 text-xs font-medium text-white"
        >
          ログイン
        </Link>
      )}
    </div>
  );
}
