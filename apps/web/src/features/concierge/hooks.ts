// apps/web/src/features/concierge/hooks.ts
"use client";
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
  const [threads, setThreads] = useState<ConciergeThread[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [requiresLogin, setRequiresLogin] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRequiresLogin(false);

    try {
      const res = await fetchThreads({ raw: true }); // axios/Fetch どちらでもOK

      // ここで status を見たいなら、lib 側で throw or value 返却を決めておく
      setThreads(res.data);
    } catch (err: any) {
      // 401 専用ハンドリング
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setRequiresLogin(true);
        setThreads(null);
        return;
      }
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { threads, loading, error, requiresLogin, reload: load, setThreads };

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

        options?.onUpdated?.({
          thread: res.thread,
          messages: res.messages,
        });
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
        const data = await fetchThreadDetail(threadId); // ← ここで fetchThreadDetail を使用
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
