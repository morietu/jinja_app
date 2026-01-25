"use client";

import * as React from "react";
import Link from "next/link";
import { fetchMyGoshuinCount, type GoshuinCount } from "@/lib/api/goshuin";

type Props = {
  className?: string;
};

export default function GoshuinLimitBadge({ className }: Props) {
  const [count, setCount] = React.useState<GoshuinCount | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const c = await fetchMyGoshuinCount();
        if (alive) setCount(c);
      } catch {
        if (alive) setCount(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return <div className={className ?? "" + " text-xs text-slate-500"}>御朱印数を確認中…</div>;
  }

  // 未ログイン/取得失敗は静かに消す（ログイン促しは別UXでやる）
  if (!count) return null;

  const label = `御朱印 ${count.count}/${count.limit}（残り${count.remaining}）`;

  if (count.can_add) {
    return (
      <div className={className ?? "" + " rounded-xl border bg-white px-3 py-2 text-xs text-slate-700"}>{label}</div>
    );
  }

  return (
    <div
      className={className ?? "" + " rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"}
    >
      {label}：上限に達しています。{" "}
      <Link href="/billing/upgrade" className="underline font-semibold">
        プランを更新
      </Link>
    </div>
  );
}
