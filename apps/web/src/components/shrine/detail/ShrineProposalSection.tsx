// apps/web/src/components/shrine/detail/ShrineProposalSection.tsx
import DetailDisclosureBlock from "@/components/shrine/DetailDisclosureBlock";

type ProposalWhyItem = {
  label: "相談との一致" | "神社のご利益" | "補助的な一致" | "上位になった理由" | "他候補との差";
  text: string;
};

export default function ShrineProposalSection({
  proposal,
  proposalLead,
  proposalWhy = [],
  symbolTags = [],
}: {
  proposal?: string;
  proposalLead?: string;
  proposalWhy?: ProposalWhyItem[];
  symbolTags?: string[];
}) {
  const primaryItems = proposalWhy.filter((item) => item.label === "相談との一致" || item.label === "神社のご利益");

  const secondaryItem = proposalWhy.find((item) => item.label === "補助的な一致") ?? null;

  const visibleSymbolTags = symbolTags.filter(Boolean).slice(0, 4);
  const hasSupplement = Boolean(secondaryItem) || visibleSymbolTags.length > 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="space-y-3">
        {proposal ? <h2 className="text-sm font-semibold text-slate-900">{proposal}</h2> : null}

        {proposalLead ? (
          <div className="rounded-xl bg-slate-50 px-3 py-3">
            <div className="mb-1 text-[11px] font-medium text-slate-500">主</div>
            <p className="text-sm leading-6 text-slate-700">{proposalLead}</p>
          </div>
        ) : null}

        {primaryItems.map((item) => {
          const heading = item.label === "相談との一致" ? "接点" : "意味";

          return (
            <div key={item.label} className="rounded-xl border border-slate-200 px-3 py-3">
              <div className="mb-1 text-[11px] font-medium text-slate-500">{heading}</div>
              <p className="text-sm leading-6 text-slate-700">{item.text}</p>
            </div>
          );
        })}

        {hasSupplement ? (
          <DetailDisclosureBlock title="補足" summary="補助的な一致や象徴を確認できます" defaultOpen={false}>
            <div className="space-y-3 px-1 py-1">
              {secondaryItem ? (
                <div className="space-y-1">
                  <div className="text-[11px] font-medium text-slate-500">補助的な一致</div>
                  <p className="text-sm leading-6 text-slate-700">{secondaryItem.text}</p>
                </div>
              ) : null}

              {visibleSymbolTags.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-[11px] font-medium text-slate-500">象徴</div>
                  <div className="flex flex-wrap gap-1.5">
                    {visibleSymbolTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </DetailDisclosureBlock>
        ) : null}
      </div>
    </section>
  );
}
