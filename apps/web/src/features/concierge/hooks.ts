// apps/web/src/features/concierge/hooks.ts
import { useEffect, useState, useCallback } from "react";
import { fetchThreads, fetchThreadDetail, postConciergeChat } from "@/lib/api/concierge";

import type { ConciergeThread, ConciergeThreadDetail, ConciergeMessage } from "@/lib/api/concierge";


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
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { threads, loading, error, reload: load, setThreads };
}

export function useConciergeThreadDetail(threadId: string | null) {
  const [detail, setDetail] = useState<ConciergeThreadDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!threadId) {
      setDetail(null);
      return;
    }
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        if (!threadId) return;
        const data = await fetchThreadDetail(threadId);
        if (!cancelled) setDetail(data);
      } catch (e) {
        if (!cancelled) setError(e as Error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [threadId]);

  return { detail, loading, error, setDetail };
}

export function useConciergeChat(
  threadId: string | null,
  opts?: {
    onUpdated?: (payload: { thread: ConciergeThread; messages: ConciergeMessage[] }) => void;
  },
) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

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
        opts?.onUpdated?.({
          thread: res.thread,
          messages: res.messages,
        });
        return res;
      } catch (e) {
        setError(e as Error);
        throw e;
      } finally {
        setSending(false);
      }
    },
    [threadId, opts],
  );

  return { send, sending, error };
}
