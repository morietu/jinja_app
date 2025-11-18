// apps/web/src/features/concierge/hooks.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  fetchThreads,
  fetchThreadDetail,
  postConciergeChat,
  type ConciergeThread,
  type ConciergeThreadDetail,
  type ConciergeMessage,
} from "@/lib/api/concierge";

/* ====== スレッド一覧 ====== */

export function useConciergeThreads() {
  const [threads, setThreads] = useState<ConciergeThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchThreads();
      setThreads(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    threads,
    loading,
    error,
    reload: load,
    setThreads,
  };
}

/* ====== スレッド詳細（メッセージ一覧） ====== */

export function useConciergeThreadDetail(threadId: string | null) {
  const [detail, setDetail] = useState<ConciergeThreadDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!threadId) {
      setDetail(null);
      setError(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchThreadDetail(threadId);
        if (!cancelled) {
          setDetail(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [threadId]);

  return { detail, loading, error, setDetail };
}

/* ====== チャット送信（/concierge/chat/） ====== */

export type UseConciergeChatOptions = {
  onUpdated?: (payload: { thread: ConciergeThread; messages: ConciergeMessage[] }) => void;
};

export function useConciergeChat(threadId: string | null, options?: UseConciergeChatOptions) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (message: string) => {
      if (!message.trim()) return;

      setSending(true);
      setError(null);

      try {
        const res = await postConciergeChat({
          message,
          thread_id: threadId ?? undefined,
        });

        // 親（Layout）に「スレッド更新されたよ」と伝える
        options?.onUpdated?.({
          thread: res.thread,
          messages: res.messages,
        });
        // 何も return しない → Promise<void> になるので ChatPanel の onSend 型と整合
      } catch (err) {
        if (axios.isAxiosError(err)) {
          setError(`チャット送信に失敗しました (${err.response?.status ?? "network error"})`);
        } else {
          setError("チャット送信に失敗しました");
        }
      } finally {
        setSending(false);
      }
    },
    [threadId, options],
  );

  return { send, sending, error };
}
