import Image from "next/image";

type Props = {
  title: string;
  imageUrl?: string | null;
};

/**
 * 一覧Heroは「候補を開かせる」ためのカード。
 * 詳細Heroは「意味宣言のあとに視覚補助を置く」ための軽い補助カード。
 * 同じ神社表示でも役割が違うため、詳細側では責務を絞った専用表示にする。
 */
export default function ShrineDetailHeroCard({ title, imageUrl = null }: Props) {
  return (
    <section className="pt-1">
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="relative h-32 w-full bg-slate-100">
          {imageUrl ? (
            <Image src={imageUrl} alt={title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 448px" />
          ) : null}
        </div>

        <div className="p-4">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
        </div>
      </article>
    </section>
  );
}
