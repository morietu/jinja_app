// apps/web/src/app/concierge/history/[id]/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useConciergeThreadDetail } from "@/features/concierge/hooks";
import ConciergeLayout from "@/features/concierge/components/ConciergeLayout";
import type { ConciergeMessage, ConciergeThread } from "@/lib/api/concierge";
import Link from "next/link";

export default function ConciergeHistoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const threadId = Array.isArray(params.id) ? params.id[0] : (params.id as string);

  const { detail, loading, error } = useConciergeThreadDetail(threadId);

  if (loading) {
    return <main className="mx-auto max-w-md px-4 py-4 text-xs text-gray-500">相談履歴を読み込んでいます…</main>;
  }

  if (error) {
    return <main className="mx-auto max-w-md px-4 py-4 text-xs text-red-700">履歴の取得に失敗しました。</main>;
  }

  if (!detail) {
    return (
      <main className="mx-auto max-w-md px-4 py-4 text-xs text-gray-500">この相談履歴は見つかりませんでした。</main>
    );
  }

  const thread: ConciergeThread = detail.thread;
  const messages: ConciergeMessage[] = detail.messages;
  const recommendations = detail.recommendations ?? [];

  const handleContinue = () => {
    router.push(`/concierge?tid=${thread.id}`);
  };

  return (
    <main className="mx-auto max-w-md px-4 py-4 space-y-3">
      <header className="flex items-center justify-between">
        <Link href="/concierge/history" className="text-xs text-gray-500 underline active:opacity-70">
          ← 履歴一覧へ戻る
        </Link>
        <h1 className="text-sm font-semibold text-gray-800">相談履歴</h1>
      </header>

      <p className="text-xs text-gray-500">過去の相談内容と、当時のおすすめ候補です。</p>

      <ConciergeLayout
        thread={thread}
        messages={messages}
        sending={false}
        error={null}
        onSend={() => {}}
        onRetry={() => {}}
        recommendations={recommendations}
        paywallNote={null}
        remainingFree={null}
        stopReason={"design"}
        canSend={false}
      />
      <button
        type="button"
        onClick={handleContinue}
        className="mt-3 w-full rounded-full bg-black py-3 text-sm font-semibold text-white shadow-md active:scale-[0.98] disabled:bg-gray-300 disabled:shadow-none"
      >
        この相談の続きでコンシェルジュに聞く
      </button>
    </main>
  );
}
