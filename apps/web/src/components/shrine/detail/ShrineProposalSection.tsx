// apps/web/src/components/shrine/detail/ShrineProposalSection.tsx

type ProposalWhyItem = {
  label: "相談との一致" | "神社のご利益" | "補助的な一致" | "上位になった理由" | "他候補との差";
  text: string;
};

export default function ShrineProposalSection({
  proposal,
  proposalLead,
  proposalWhy = [],
}: {
  proposal?: string;
  proposalLead?: string;
  proposalWhy?: ProposalWhyItem[];
}) {
  if (!proposal && !proposalLead && proposalWhy.length === 0) return null;

  return (
    <section className="rounded-2xl border bg-white p-4 space-y-4">
      {proposal ? (
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{proposal}</h2>
        </div>
      ) : null}

      {proposalLead ? (
        <div className="rounded-xl bg-slate-50 px-4 py-3">
          <div className="text-xs font-semibold text-slate-500">主軸</div>
          <p className="mt-1 text-sm leading-6 text-slate-800">{proposalLead}</p>
        </div>
      ) : null}

      {proposalWhy.length > 0 ? (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-500">なぜこの神社か</div>
          <div className="space-y-3">
            {proposalWhy.map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200 px-4 py-3">
                <div className="text-xs font-semibold text-slate-600">{item.label}</div>
                <p className="mt-1 text-sm leading-6 text-slate-800">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
