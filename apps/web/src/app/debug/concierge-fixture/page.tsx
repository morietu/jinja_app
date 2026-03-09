"use client";

import { ShrineList } from "@/components/shrines/ShrineList";
import sample from "@/viewmodels/concierge/fixtures/concierge.sample.json";
import { conciergeToShrineListItems, type ConciergeResponse } from "@/viewmodels/conciergeToShrineList";

export default function ConciergeFixturePage() {
  const resp = sample as unknown as ConciergeResponse;
  const items = conciergeToShrineListItems(resp);

  const resultState =
    resp.data?._signals && typeof resp.data._signals === "object" ? (resp.data._signals as any).result_state : null;

  const headerMessage = typeof resp.data?.message === "string" ? resp.data.message : null;

  const notice = resultState && typeof resultState.ui_disclaimer_ja === "string" ? resultState.ui_disclaimer_ja : null;

  return (
    <main className="mx-auto max-w-3xl p-6">
      <ShrineList items={items} variant="list" headerMessage={headerMessage} notice={notice} />
    </main>
  );
}
