// apps/web/src/hooks/useConciergeSearch.ts
import { useCallback, useState } from "react";
import { searchConcierge } from "@/lib/api/conciergeClient";
import { conciergeToShrineListItems, type ConciergeResponse } from "@/viewmodels/conciergeToShrineList";
import type { ShrineListItem } from "@/components/shrines/ShrineList";

type Result = {
  loading: boolean;
  error: string | null;
  items: ShrineListItem[];
  headerMessage: string | null;
  notice: string | null;
  search: (text: string) => Promise<void>;
  clear: () => void;
};

export function useConciergeSearch(): Result {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ShrineListItem[]>([]);
  const [headerMessage, setHeaderMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const clear = useCallback(() => {
    setError(null);
    setItems([]);
    setHeaderMessage(null);
    setNotice(null);
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

        console.log("raw concierge resp", resp);
        console.log(
          "raw explanations",
          resp.data?.recommendations?.map((r, idx) => ({
            idx,
            name: r.name,
            explanation: r.explanation,
            reasons: r.explanation?.reasons,
          })),
        );

        const items = conciergeToShrineListItems(resp);

        console.log(
          "mapped items",
          items.map((item, idx) => ({
            idx,
            name: item.cardProps.name,
            explanationSummary: item.cardProps.explanationSummary,
            explanationReasons: item.cardProps.explanationReasons,
          })),
        );

        const resultState =
          resp.data?._signals && typeof resp.data._signals === "object"
            ? (resp.data._signals as any).result_state
            : null;

        const headerMessage = typeof resp.data?.message === "string" ? resp.data.message : null;

        const notice =
          resultState && typeof resultState.ui_disclaimer_ja === "string" ? resultState.ui_disclaimer_ja : null;

        setItems(items);
        setHeaderMessage(headerMessage);
        setNotice(notice);
      } catch (e) {
        setError(e instanceof Error ? e.message : "検索に失敗しました");
        setItems([]);
        setHeaderMessage(null);
        setNotice(null);
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
    search,
    clear,
  };
}
