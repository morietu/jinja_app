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
  type ConciergeChatRequest,
} from "@/lib/api/concierge";

/** 座標（チャットに添える用） */
type LatLng = { lat: number; lng: number };

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
      setThreads(data ?? []);
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
        if (!cancelled) setError(err as Error);
      } finally {
        if (!cancelled) setLoading(false);
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
  /** 現在地（あれば lat/lng を payload に載せる） */
  origin?: LatLng;
  /** 送信後にスレッド／メッセージを親コンポーネント側で更新したいとき */
  onUpdated?: (payload: { thread?: ConciergeThread; messages?: ConciergeMessage[] }) => void;
};

export function useConciergeChat(threadId: string | null, options?: UseConciergeChatOptions) {
  const { origin, onUpdated } = options ?? {};

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (message: string) => {
      if (!message.trim()) return;

      setSending(true);
      setError(null);

      try {
        // lat/lng 付き payload（バックエンドは余分なキーは無視する想定）
        const payload: ConciergeChatRequest & {
          lat?: number;
          lng?: number;
        } = {
          message,
          thread_id: threadId ?? undefined,
        };

        if (origin) {
          payload.lat = origin.lat;
          payload.lng = origin.lng;
        }

        const res = await postConciergeChat(payload);

        onUpdated?.({
          thread: res.thread,
          messages: res.messages,
        });

        // ChatPanel 的には戻り値不要なので何も return しない（＝Promise<void> 扱い）
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
    [threadId, origin, onUpdated],
  );

  return { send, sending, error };
}
