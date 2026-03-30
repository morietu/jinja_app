import { useCallback, useState } from "react";
import { searchConcierge } from "@/lib/api/conciergeClient";
import { conciergeToShrineListItems, type ConciergeResponse } from "@/viewmodels/conciergeToShrineList";

import type { ConciergeResultItem } from "@/viewmodels/conciergeResultItem";

type Result = {
  loading: boolean;
  error: string | null;
  items: ConciergeResultItem[];
  headerMessage: string | null;
  notice: string | null;
  remaining: number | null;
  limitReached: boolean;
  limit: number | null;
  reply: string | null;
  search: (text: string) => Promise<void>;
  clear: () => void;
};

export function useConciergeSearch(): Result {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ConciergeResultItem[]>([]);
  const [headerMessage, setHeaderMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [limit, setLimit] = useState<number | null>(null);
  const [reply, setReply] = useState<string | null>(null);

  const clear = useCallback(() => {
    setError(null);
    setItems([]);
    setHeaderMessage(null);
    setNotice(null);
    setRemaining(null);
    setLimitReached(false);
    setLimit(null);
    setReply(null);
  }, []);

  const search = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t) {
        clear();
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const resp: ConciergeResponse = await searchConcierge({ text: t });

        const items = conciergeToShrineListItems(resp);

        const resultState =
          resp.data?._signals && typeof resp.data._signals === "object"
            ? (resp.data._signals as any).result_state
            : null;

        const headerMessage = typeof resp.data?.message === "string" ? resp.data.message : null;
        const notice =
          resultState && typeof resultState.ui_disclaimer_ja === "string" ? resultState.ui_disclaimer_ja : null;

        console.log("[useConciergeSearch] parsed", {
          remaining: resp.remaining,
          limitReached: resp.limitReached,
          limit: resp.limit,
          reply: resp.reply,
          itemsLen: items.length,
          headerMessage,
          notice,
          thread_id: resp.thread_id ?? resp.data?.thread_id ?? null,
          firstItemTid: items[0]?.tid ?? null,
          firstItem: items[0] ?? null,
        });

        setItems(items);
        setHeaderMessage(headerMessage);
        setNotice(notice);
        setRemaining(typeof resp.remaining === "number" ? resp.remaining : null);
        setLimit(typeof resp.limit === "number" ? resp.limit : null);
        setLimitReached(resp.limitReached === true);
        setReply(typeof resp.reply === "string" ? resp.reply : null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "検索に失敗しました");
        setItems([]);
        setHeaderMessage(null);
        setNotice(null);
        setRemaining(null);
        setLimit(null);
        setLimitReached(false);
        setReply(null);
      } finally {
        setLoading(false);
      }
    },
    [clear],
  );

  return {
    loading,
    error,
    items,
    headerMessage,
    notice,
    remaining,
    limit,
    limitReached,
    reply,
    search,
    clear,
  };
}
