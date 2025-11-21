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
  type ConciergeRecommendation,
} from "@/lib/api/concierge";

/* ====== スレッド一覧 ====== */

export function useConciergeThreads() {
  const [threads, setThreads] = useState<ConciergeThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [requiresLogin, setRequiresLogin] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRequiresLogin(false);

    try {
      // ここで 401 が飛んでくる前提
      const data = await fetchThreads();
      setThreads(Array.isArray(data) ? data : []);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        // 未ログイン → 履歴は空
        setRequiresLogin(true);
        setThreads([]);
      } else {
        setError(err as Error);
      }
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
    requiresLogin,
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
          // 401/403/404 のときは fetchThreadDetail 側で null を返す実装にしてある
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
  // 本番API: thread/messages/recommendations が返ってきたとき
  onUpdated?: (payload: {
    thread: ConciergeThread;
    messages: ConciergeMessage[];
    recommendations?: ConciergeRecommendation[] | null;
  }) => void;

  // echo だけ返ってきたとき用（未ログインなど）
  onReply?: (reply: string) => void;
};

// apps/web/src/features/concierge/hooks.ts

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

        if (res.thread && res.messages && res.messages.length > 0) {
          options?.onUpdated?.({
            thread: res.thread,
            messages: res.messages,
            recommendations: res.recommendations ?? null,
          });
          return;
        }

        if (res.reply) {
          let replyText = res.reply ?? "";
          replyText = replyText.replace(/^echo:\s*/i, "");
          options?.onReply?.(replyText);
        }
      } catch (err) {
        let msg = "チャット送信に失敗しました";

        if (axios.isAxiosError(err)) {
          msg = `チャット送信に失敗しました (${err.response?.status ?? "network error"})`;
        }

        // フック内だけで完結させる
        setError(msg);

        // ★ ここでは throw しない
        // throw new Error(msg);
      } finally {
        setSending(false);
      }
    },
    [threadId, options],
  );

  return { send, sending, error };
}
