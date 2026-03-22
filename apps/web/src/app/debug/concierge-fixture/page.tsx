import ConciergeShrineCard from "@/components/shrine/ConciergeShrineCard";
import { conciergeToShrineListItems, type ConciergeResponse } from "@/viewmodels/conciergeToShrineList";

const fixture: ConciergeResponse = {
  ok: true,
  thread_id: "debug-thread-1",
  data: {
    message: "相談内容と近さをもとに、参拝候補を3件に整理しました。",
    _need: {
      tags: ["money", "courage"],
    },
    _signals: {
      result_state: {
        ui_disclaimer_ja: null,
      },
    },
    recommendations: [
      {
        name: "出雲大社",
        display_name: "出雲大社",
        shrine_id: 4,
        address: "島根県出雲市大社町杵築東195",
        reason: "縁結びのご利益で知られる出雲大社は、金運向上を願う参拝先として適しています。",
        explanation: {
          summary: "縁結びのご利益で知られる出雲大社は、金運向上を願う参拝先として適しています。",
        },
        breakdown: {
          score_element: 0,
          score_need: 2,
          score_popular: 0,
          score_total: 0.6,
          weights: {
            element: 0.6,
            need: 0.3,
            popular: 0.1,
          },
          matched_need_tags: ["money", "courage"],
        },
      },
    ],
  },
};

export default function Page() {
  const resp = fixture;
  const items = conciergeToShrineListItems(resp);

  const headerMessage = typeof resp.data?.message === "string" ? resp.data.message : null;

  const notice =
    resp.data?._signals &&
    typeof resp.data._signals === "object" &&
    typeof (resp.data._signals as any)?.result_state?.ui_disclaimer_ja === "string"
      ? (resp.data._signals as any).result_state.ui_disclaimer_ja
      : null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="space-y-4">
        {headerMessage ? <div className="text-sm text-slate-700">{headerMessage}</div> : null}

        {notice ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {notice}
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          {items.map(({ id, cardProps, tid }, idx) => (
            <ConciergeShrineCard key={id} {...cardProps} tid={tid ?? null} hideLeftMark={idx !== 0} />
          ))}
        </div>
      </div>
    </main>
  );
}
