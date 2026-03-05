"use client";

import { ShrineList } from "@/components/shrines/ShrineList";
import sample from "@/viewmodels/concierge/fixtures/concierge.sample.json";
import { conciergeToShrineListItems, type ConciergeResponse } from "@/viewmodels/conciergeToShrineList";

export default function ConciergeFixturePage() {
  const items = conciergeToShrineListItems(sample as unknown as ConciergeResponse);

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-4">Concierge Fixture（デバッグ）</h1>
      <ShrineList items={items} variant="list" />
    </main>
  );
}
