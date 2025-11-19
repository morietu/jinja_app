// apps/web/src/features/concierge/components/ConciergeLayout.tsx
"use client";

import { useState, useMemo } from "react";
import { useConciergeThreads, useConciergeThreadDetail, useConciergeChat } from "../hooks";
import { ThreadList } from "./ThreadList";
import ChatPanel from "./ChatPanel";
import type { ConciergeThread } from "@/lib/api/concierge";

export default function ConciergeLayout() {
  const { threads, loading: loadingThreads, setThreads, requiresLogin } = useConciergeThreads();

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const { detail, loading: loadingDetail, setDetail } = useConciergeThreadDetail(selectedThreadId);

  const { send, sending } = useConciergeChat(selectedThreadId, {
    onUpdated: ({ thread, messages }) => {
      // 詳細を更新
      setDetail({ thread, messages });

      // スレッド一覧の更新（新規作成 or last_message_at 更新）
      setThreads((prev) => {
        const prevSafe = Array.isArray(prev) ? prev : [];
        const others = prevSafe.filter((t) => String((t as any).id) !== String((thread as any).id));
        return [thread, ...others];
      });

      // 新規スレッドなら自動的に選択（string に統一）
      setSelectedThreadId(String((thread as any).id));
    },
  });

  const handleSelectThread = (id: string) => {
    setSelectedThreadId(id);
  };

  const handleStartNew = () => {
    setSelectedThreadId(null);
    setDetail(null);
  };

  // 選択中スレッド（detail があればそれを、なければ一覧から探す）
  const activeThread: ConciergeThread | null = useMemo(() => {
    if (detail?.thread) return detail.thread;
    if (!selectedThreadId) return null;
    return (threads ?? []).find((t) => String((t as any).id) === selectedThreadId) ?? null;
  }, [detail, threads, selectedThreadId]);

  const messages = detail?.messages ?? [];

  return (
    <div className="flex h-full gap-4">
      <div className="w-full border-b pb-4 md:w-1/3 md:border-b-0 md:border-r md:pr-4">
        <ThreadList
          threads={threads}
          loading={loadingThreads}
          requiresLogin={requiresLogin}
          selectedId={selectedThreadId}
          onSelect={handleSelectThread}
          onCreateNew={handleStartNew}
        />
      </div>

      <div className="flex-1">
        <ChatPanel thread={activeThread} messages={messages} loading={loadingDetail} sending={sending} onSend={send} />
      </div>
    </div>
  );
}
