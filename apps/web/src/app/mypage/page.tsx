// apps/web/src/app/mypage/page.tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";              // ★ 追加
import MyPageView from "@/components/views/MyPageView";

const TABS = [
  { key: "goshuin", label: "御朱印帳" },
  { key: "profile", label: "プロフィール" },
  { key: "settings", label: "設定" },
] as const;

export default function MyPage() {
  const sp = useSearchParams();
  const tab = sp.get("tab") ?? "goshuin";

  const content = useMemo(() => {
    switch (tab) {
      case "goshuin":
        return <div className="p-4">（WIP）御朱印一覧 / 追加ボタン etc.</div>;
      case "profile":
        // ← プレースホルダーの代わりに実装済みビューを表示
        return <MyPageView />;
      case "settings":
        return <div className="p-4">（WIP）通知やテーマ設定</div>;
      default:
        return <div className="p-4 text-red-600">未知のタブです: {tab}</div>;
    }
  }, [tab]);


  return (
    <main className="max-w-4xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">マイページ</h1>
      <nav className="flex gap-2 border-b pb-2">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={`/mypage?tab=${t.key}`}
              className={`px-3 py-1 rounded-t ${active ? "bg-emerald-600 text-white" : "bg-gray-100"}`}
              aria-current={active ? "page" : undefined}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      <section className="min-h-40 border rounded p-4">{content}</section>
    </main>
  );
}
