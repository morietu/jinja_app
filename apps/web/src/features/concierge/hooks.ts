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

import type { ConciergeChatRequestV1, ConciergeChatFilters } from "@/features/concierge/types/chatRequest";

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
  filters?: ConciergeChatFilters;
  onUnified?: (u: UnifiedConciergeResponse) => void;

  onUpdated?: (payload: {
    thread: ConciergeThread;
    messages?: ConciergeMessage[];
    recommendations?: ConciergeRecommendation[] | null;

    // paywallなど将来拡張用
    remaining_free?: number;
    limit?: number;
    note?: string;
  }) => void;

  onReply?: (reply: string) => void;
  onRecommendations?: (recs: ConciergeRecommendation[]) => void;

  // thread が無いケースでも paywall だけ出したいなら使う
  onPaywall?: (payload: { remaining_free?: number; limit?: number; note?: string }) => void;
};

type SendInput = string | Omit<ConciergeChatRequestV1, "thread_id">;

function normalizeConciergeResponse(raw: any, recs: ConciergeRecommendation[]): UnifiedConciergeResponse {
  const stop: StopReason =
    raw?.stop_reason === "design" || raw?.stop_reason === "paywall"
      ? raw.stop_reason
      : typeof raw?.remaining_free === "number" && raw.remaining_free <= 0
        ? "paywall"
        : null;

  const note = typeof raw?.note === "string" ? raw.note : null;
  const replyCandidate = raw?.reply ?? raw?.data?.reply ?? raw?.data?.raw ?? null;
  const reply = typeof replyCandidate === "string" ? replyCandidate : null;

  const ok = raw?.ok === false ? false : true;
  const remaining_free = typeof raw?.remaining_free === "number" ? raw.remaining_free : null;

  const tid = Number(raw?.thread?.id);
  const thread = raw?.thread && Number.isFinite(tid) ? ({ ...raw.thread, id: tid } as ConciergeThread) : null;

  // ✅ raw.data を保持（objectのみ）。arrayは捨てる
  const rawData = raw?.data && typeof raw.data === "object" && !Array.isArray(raw.data) ? raw.data : {};

  const sig = (rawData as any)?._signals;
  if (!sig || typeof sig !== "object" || Array.isArray(sig)) {
    delete (rawData as any)._signals;
  }

  return {
    ok,
    stop_reason: stop,
    note,
    reply,
    remaining_free,
    thread,
    data: { ...rawData, recommendations: recs },
  };
}

/**
 * ✅ send() は string と structured request 両方OK
 * - thread_id は hooks 側で注入
 */
export function useConciergeChat(threadId: string | null, options?: UseConciergeChatOptions) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (input: SendInput) => {
      const baseFilters = options?.filters;

      const req: ConciergeChatRequestV1 =
        typeof input === "string"
          ? { version: 1, query: input.trim(), thread_id: threadId ?? undefined }
          : { ...input, version: 1, thread_id: threadId ?? undefined };

      // ✅ filters を必ず合成（input 側が優先、無ければ base）
      const mergedFilters = {
        ...(baseFilters ?? {}),
        ...((req as any).filters ?? {}),
      };

      // ✅ 空なら付けない（ログ汚し防止）
      if (Object.keys(mergedFilters).length > 0) {
        (req as any).filters = mergedFilters;
      }

      // query は必須（空なら送らない）
      if (!req.query?.trim()) return;

      setSending(true);
      setError(null);

      try {
        const res = await postConciergeChat(req);

        // axiosレスポンス/生payload 両対応
        const isAxiosLike = !!res && typeof res === "object" && "status" in (res as any) && "data" in (res as any);
        const payload = isAxiosLike ? (res as any).data : res;

        // recommendations は payload 起点で統一
        const recs = normalizeRecommendations(payload?.data?.recommendations ?? payload?.recommendations);

        // unified も payload 起点で統一（raw.data を保持しつつ recs を上書き）
        const unified = normalizeConciergeResponse(payload, recs);

        const signals = payload?.data?._signals;
        if (signals && typeof signals === "object" && !Array.isArray(signals)) {
          (unified as any).data._signals = signals;
        }



       

        options?.onUnified?.(unified);
        options?.onRecommendations?.(recs);

        options?.onPaywall?.({
          remaining_free: payload?.remaining_free,
          limit: payload?.limit,
          note: payload?.note,
        });

        if (payload?.thread) {
          options?.onUpdated?.({
            thread: payload?.thread ?? null,
            recommendations: recs,
            remaining_free: payload?.remaining_free,
            limit: payload?.limit,
            note: payload?.note,
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
          thread: null,
          remaining_free: null,
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

// 型も re-export（使う側が hooks から import したい時用）
export type { ConciergeChatRequestV1, ConciergeChatFilters };
export type { SendInput as ConciergeChatSendInput };
