// src/features/concierge/hooks/useConciergeChat.ts
import { useCallback, useState } from "react";
import { postConciergeChat } from "../api";
import type {
  ConciergeChatRequest,
  ConciergeChatSuccessResponse,
  
  ChatMessageItem,
} from "../types";

/**
 * 既存のシンプルな「1リクエスト→1レスポンス」用 hook
 * （既存コンポーネント互換）
 */
type UseConciergeChatResult = {
  loading: boolean;
  error: string | null;
  response: ConciergeChatSuccessResponse | null;
  send: (payload: ConciergeChatRequest) => Promise<void>;
  reset: () => void;
};

export function useConciergeChat(): UseConciergeChatResult {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ConciergeChatSuccessResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async (payload: ConciergeChatRequest) => {
    setLoading(true);
    setError(null);

    try {
      const { status, body } = await postConciergeChat(payload);

      // 429: スロットリング
      if (status === 429) {
        const message =
          "detail" in body && typeof body.detail === "string"
            ? body.detail
            : "現在リクエストが集中しているため、少し時間をおいてから再度お試しください。";

        setError(message);
        setResponse(null);
        return;
      }

      // 2xx 成功
      if ("ok" in body && body.ok) {
        setResponse(body);
        setError(null);
        return;
      }

      // DRF エラー (400 など)
      if ("detail" in body) {
        setError(body.detail);
        setResponse(null);
        return;
      }

      setError("想定外のレスポンス形式です。");
      setResponse(null);
    } catch (e) {
      console.error(e);
      setError("通信に失敗しました。ネットワーク環境を確認してください。");
      setResponse(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setResponse(null);
  }, []);

  return { loading, error, response, send, reset };
}

/**
 * 新しい「チャットセッション」用 hook
 * - messages（ユーザー＋コンシェルジュ）を保持
 * - lastResponse で raw レスポンスも参照可能
 */
type UseConciergeChatSessionOptions = {
  initialLat: number;
  initialLng: number;
  initialCandidates?: ConciergeChatRequest["candidates"];
};

type UseConciergeChatSessionResult = {
  messages: ChatMessageItem[];
  // ★ 成功レスポンスだけに絞る
  lastResponse: ConciergeChatSuccessResponse | null;
  isLoading: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
};

export function useConciergeChatSession(options: UseConciergeChatSessionOptions): UseConciergeChatSessionResult {
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [lastResponse, setLastResponse] = useState<ConciergeChatSuccessResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<number | undefined>(undefined);

  async function sendMessage(text: string) {
    if (!text.trim()) return;

    const now = new Date();
    const userMessage: ChatMessageItem = {
      id: `user-${now.getTime()}`,
      role: "user",
      text,
      createdAt: now,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const payload: ConciergeChatRequest = {
        message: text,
        lat: options.initialLat,
        lng: options.initialLng,
        candidates: options.initialCandidates,
        // backend 側で thread_id / threadId 両方見ているので camelCase でもOK
        threadId,
      };

      const { status, body } = await postConciergeChat(payload);

      if (status === 429) {
        const msg =
          "detail" in body && typeof body.detail === "string"
            ? body.detail
            : "現在リクエストが集中しているため、少し時間をおいてから再度お試しください。";
        setError(msg);
        return;
      }

      if (!("ok" in body) || !body.ok) {
        if ("detail" in body && typeof body.detail === "string") {
          setError(body.detail);
        } else {
          setError("想定外のレスポンス形式です。");
        }
        return;
      }

      // ここから先は成功レスポンスとして扱う
      setLastResponse(body);

      const assistantMessage: ChatMessageItem = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: body.reply,
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (body.thread?.id) {
        setThreadId(body.thread.id);
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "コンシェルジュAPIでエラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  }

  return {
    messages,
    lastResponse,
    isLoading,
    error,
    sendMessage,
  };
}
