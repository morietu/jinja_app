// apps/web/src/components/shrine/detail/ShrineJudgeSection.tsx
import type { DetailMeaningSection } from "@/components/shrine/detail/types";

type Props = {
  section: DetailMeaningSection;
};

export default function ShrineJudgeSection({ section }: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold text-slate-900">{section.heading}</h2>

      <div className="mt-4 space-y-3">
        {section.items.map((item, i) => (
          <div key={item.key} className={i === 0 ? "rounded-xl bg-slate-100 p-3" : "rounded-xl bg-slate-50 p-3"}>
            <h3 className="text-sm font-medium text-slate-700">{item.title}</h3>

            <p className="mt-1 text-sm leading-7 text-slate-600">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
