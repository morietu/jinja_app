// apps/web/src/features/concierge/components/ConciergeLayout.tsx
"use client";

import { useState } from "react";
import { useConciergeThreads, useConciergeThreadDetail, useConciergeChat } from "../hooks";
import ThreadList from "./ThreadList";
import ChatPanel from "./ChatPanel";

export default function ConciergeLayout() {
  const { threads, loading: loadingThreads, error: _error, reload: _reload, setThreads } = useConciergeThreads();

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const { detail, loading: loadingDetail, setDetail } = useConciergeThreadDetail(selectedThreadId);

  const { send: rawSend, sending } = useConciergeChat(selectedThreadId, {
    onUpdated: ({ thread, messages }) => {
      setDetail({ thread, messages });
      setThreads((prev) => {
        const others = prev.filter((t) => t.id !== thread.id);
        return [thread, ...others];
      });
    },
  });

  // ChatPanel に渡す用に Promise<void> に揃えたラッパー
  const send = async (text: string): Promise<void> => {
    await rawSend(text);
  };

  const handleSelectThread = (id: string) => {
    setSelectedThreadId(id);
  };

  const handleStartNew = () => {
    setSelectedThreadId(null);
    setDetail(null);
  };

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
          thread={detail?.thread ?? null}
          messages={detail?.messages ?? []}
          loading={loadingDetail}
          sending={sending}
          onSend={send}
        />
      </div>
    </div>
  );
}
