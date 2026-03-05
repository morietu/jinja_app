// apps/web/src/hooks/useConciergeSearch.ts
"use client";

import { useCallback, useState } from "react";
import { searchConcierge } from "@/lib/api/conciergeClient";
import { conciergeToShrineListItems, type ConciergeResponse } from "@/viewmodels/conciergeToShrineList";
import type { ShrineListItem } from "@/components/shrines/ShrineList";

type State = {
  items: ShrineListItem[];
  loading: boolean;
  error: string | null;
  lastResponse?: ConciergeResponse;
};

export function useConciergeSearch() {
  const [state, setState] = useState<State>({
    items: [],
    loading: false,
    error: null,
  });

  const submit = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t) {
      setState((s) => ({ ...s, error: "入力が空です。ひとことでもいいので書いてください。", items: [] }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const resp = await searchConcierge({ text: t });

      if (!resp?.ok) {
        setState((s) => ({
          ...s,
          loading: false,
          error: "うまく解釈できませんでした。もう少し具体的に書いてください。",
          items: [],
          lastResponse: resp,
        }));
        return;
      }

      const items = conciergeToShrineListItems(resp);
      setState((s) => ({
        ...s,
        loading: false,
        error: null,
        items,
        lastResponse: resp,
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown error";
      setState((s) => ({
        ...s,
        loading: false,
        error: `通信に失敗しました（${msg}）`,
        items: [],
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setState({ items: [], loading: false, error: null });
  }, []);

  return { ...state, submit, reset };
}
