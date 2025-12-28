// apps/web/src/features/concierge/hooks.ts

"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import type { UnifiedConciergeResponse, StopReason } from "@/features/concierge/types/unified";

import { normalizeRecommendations } from "@/lib/api/concierge/normalize";
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
      const data = await fetchThreads();
      setThreads(Array.isArray(data) ? data : []);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
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

  return { threads, loading, error, requiresLogin, reload: load, setThreads };
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
        if (!cancelled) setDetail(data);
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
  
  onUnified?: (u: UnifiedConciergeResponse) => void;
  
  onUpdated?: (payload: {
    thread: ConciergeThread;
    messages?: ConciergeMessage[];
    recommendations?: ConciergeRecommendation[] | null;

    // ★ paywall情報
    remaining_free?: number;
    limit?: number;
    note?: string;
  }) => void;

  onReply?: (reply: string) => void;
  onRecommendations?: (recs: ConciergeRecommendation[]) => void;

  // ★ thread が無いケースでも paywall だけ出したいなら使う
  onPaywall?: (payload: { remaining_free?: number; limit?: number; note?: string }) => void;
};

function normalizeConciergeResponse(
  raw: any,
  recs: Array<{ name: string; reason?: string }>,
): UnifiedConciergeResponse {
  // stop_reason が無いバックでも paywall は拾えるようにする（安全）
  const stop: StopReason =
    raw?.stop_reason === "design" || raw?.stop_reason === "paywall"
      ? raw.stop_reason
      : typeof raw?.remaining_free === "number" && raw.remaining_free <= 0
        ? "paywall"
        : null;

  const note = typeof raw?.note === "string" ? raw.note : null;

  const replyCandidate = raw?.reply ?? raw?.data?.reply ?? raw?.data?.raw ?? null;
  const reply = typeof replyCandidate === "string" ? replyCandidate : null;

  // ok は「通信が成功したら true」扱いに寄せる（raw.ok が明示 false のときだけ false）
  const ok = raw?.ok === false ? false : true;

  return {
    ok,
    stop_reason: stop,
    note,
    reply,
    data: { recommendations: recs },
  };
}

export function useConciergeChat(threadId: string | null, options?: UseConciergeChatOptions) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (message: string) => {
      if (!message.trim()) return;

      setSending(true);
      setError(null);

      try {
        const res = await postConciergeChat({ query: message, thread_id: threadId ?? undefined });

        // ✅ recs はここで正規化して統一
        const recs = normalizeRecommendations(res.data?.recommendations);

        // ✅ Unified を作って必ず流す（これがBFF/adapterの要）
        const unified = normalizeConciergeResponse(res, recs);
        options?.onUnified?.(unified);

        options?.onRecommendations?.(recs);

        // paywall は thread の有無に関係なく拾う（UI側で optional で扱える）
        options?.onPaywall?.({
          remaining_free: res.remaining_free,
          limit: res.limit,
          note: res.note,
        });

        if (res.thread) {
          options?.onUpdated?.({
            thread: res.thread,
            recommendations: recs,
            remaining_free: res.remaining_free,
            limit: res.limit,
            note: res.note,
          });
        }

        if (unified.reply) {
          options?.onReply?.(unified.reply.replace(/^echo:\s*/i, ""));
        }
      } catch (err) {
        const unified: UnifiedConciergeResponse = {
          ok: false,
          stop_reason: null,
          note: "チャット送信に失敗しました",
          reply: null,
          data: { recommendations: [] },
        };
        options?.onUnified?.(unified);

        let msg = "チャット送信に失敗しました";
        if (axios.isAxiosError(err)) {
          msg = `チャット送信に失敗しました (${err.response?.status ?? "network error"})`;
        }
        setError(msg);
      } finally {
        setSending(false);
      }
    },
    [threadId, options],
  );

  return { send, sending, error };
}
