// src/features/concierge/hooks/useConciergeChat.ts
import { useCallback, useState } from "react";
import { postConciergeChat } from "../api";
import type { ConciergeChatRequest, ConciergeChatSuccessResponse } from "../types";

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
