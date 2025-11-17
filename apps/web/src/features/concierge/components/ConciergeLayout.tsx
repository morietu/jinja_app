"use client";

import { useCallback, useState } from "react";
import { useConciergeThreads, useConciergeThreadDetail, useConciergeChat } from "../hooks";
import ThreadList from "./ThreadList";
import ChatPanel from "./ChatPanel";

export default function ConciergeLayout() {
  const { threads, loading: loadingThreads, setThreads } = useConciergeThreads();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const { detail, loading: loadingDetail, setDetail } = useConciergeThreadDetail(selectedThreadId);

  const { send, sending } = useConciergeChat(selectedThreadId, {
    onUpdated: ({ thread, messages }) => {
      if (!thread) {
        const safeMessages = messages ?? detail?.messages ?? [];
        setDetail((prev) => (prev ? { ...prev, messages: safeMessages } : null));
        return;
      }

      const safeMessages = messages ?? detail?.messages ?? [];

      setDetail({ thread, messages: safeMessages });

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
