// 例: src/app/goshuin/new/page.tsx（成功時の遷移だけ抜粋）
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function GoshuinNewPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setBusy(true);
      // ← ここで御朱印POST（/api/goshuin/ など）を実行
      // await api.post("/goshuin/", payload);
      // 成功トースト（任意）
      // toast.success("御朱印を登録しました");
      router.push("/mypage?tab=goshuin");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="p-4 space-y-3">
      {/* 入力フィールド… */}
      <button className="px-4 py-2 bg-blue-600 text-white rounded" disabled={busy}>
        {busy ? "登録中…" : "登録する"}
      </button>
    </form>
  );
}
