// apps/web/src/features/concierge/components/ConciergeLayout.tsx
"use client";

import { useCallback, useState } from "react";
import { useConciergeThreads, useConciergeThreadDetail, useConciergeChat } from "../hooks";
import ThreadList from "./ThreadList";
import ChatPanel from "./ChatPanel";

type LatLng = { lat: number; lng: number };

type Props = {
  origin: LatLng | null;
};

export default function ConciergeLayout({ origin }: Props) {
  const { threads, loading: loadingThreads, setThreads } = useConciergeThreads();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const { detail, loading: loadingDetail, setDetail } = useConciergeThreadDetail(selectedThreadId);

  const { send, sending } = useConciergeChat(selectedThreadId, {
    // origin があれば hooks 側で lat/lng を付けたいので渡しておく
    origin: origin ?? undefined,
    onUpdated: ({ thread, messages }) => {
      // thread が返ってこないケース（いまの compat バックエンド）を許容
      if (!thread) {
        if (messages && messages.length > 0) {
          setDetail((prev) =>
            prev
              ? { ...prev, messages }
              : // thread 不明だが、とりあえずメッセージだけ持っておく
                { thread: undefined as any, messages },
          );
        }
        return;
      }

      const safeMessages = messages ?? detail?.messages ?? [];

      // 詳細の更新
      setDetail({ thread, messages: safeMessages });

      // スレッド一覧の更新（新規 or 更新）
      setThreads((prev) => {
        const others = prev.filter((t) => t.id !== thread.id);
        return [thread, ...others];
      });
    },
  });

  const activeThread = detail?.thread ?? null;
  const messages = detail?.messages ?? [];

  const handleSelectThread = (id: string) => {
    setSelectedThreadId(id);
  };

  const handleStartNew = useCallback(() => {
    setSelectedThreadId(null);
    setDetail(null);
  }, [setDetail]);

  const handleSend = useCallback(
    async (text: string) => {
      // send は ConciergeChatResponse | undefined を返すが、
      // ここでは結果を返さず「待つだけ」にして Promise<void> として扱う
      await send(text);
    },
    [send],
  );

  return (
    <div className="flex h-full gap-4">
      <div className="w-1/3 border-r pr-4">
        <ThreadList
          threads={threads}
          loading={loadingThreads}
          selectedId={selectedThreadId}
          onSelect={handleSelectThread}
          onCreateNew={handleStartNew}
        />
      </div>
      <div className="flex-1">
        <ChatPanel
          thread={activeThread}
          messages={messages}
          loading={loadingDetail}
          sending={sending}
          onSend={handleSend}
        />
      </div>
    </div>
  );
}
