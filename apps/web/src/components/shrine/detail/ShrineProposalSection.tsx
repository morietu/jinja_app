// apps/web/src/components/shrine/detail/ShrineProposalSection.tsx

type Props = {
  proposal?: string | null;
  proposalReason?: string | null;
};

export default function ShrineProposalSection({ proposal, proposalReason }: Props) {
  const main = (proposal ?? "").trim();
  const reason = (proposalReason ?? "").trim();

  if (!main && !reason) return null;

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-4">
      <p className="text-xs font-semibold tracking-wide text-emerald-700">今回の提案</p>
      {main ? <h2 className="mt-1 text-lg font-bold leading-7 text-slate-900">{main}</h2> : null}
      {reason ? <p className="mt-2 text-sm leading-6 text-slate-700">{reason}</p> : null}
    </section>
  );
}
