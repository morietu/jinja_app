// apps/web/src/features/home/HomePage.tsx
import { SectionCard } from "@/components/layout/SectionCard";
import { HomeNearbySection } from "@/features/home/components/HomeNearbySection";
import { HomeToastClient } from "@/features/home/components/HomeToastClient";
import { PublicGoshuinsClient } from "@/features/home/components/PublicGoshuinsClient";

type Goshuin = {
  id: number;
  shrine?: number;
  title?: string | null;
  image_url?: string | null;
  shrine_name?: string | null;
};

type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };

export default function HomePage({ publicGoshuins }: { publicGoshuins: Paginated<Goshuin> | null }) {
  const results = publicGoshuins?.results ?? [];
  const hasPublic = results.length > 0;

  // ✅ A: ここに来る results は最大9件（page.tsxでlimit=9）
  const topResults = results.slice(0, 9);

  return (
    <main className="min-h-screen bg-slate-50">
      {/* ✅ toast処理だけ client */}
      <HomeToastClient />

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8">
        <SectionCard>
          {/* ここは server なので Link でOK */}
          <a
            className="mt-6 block w-full rounded-full bg-amber-500 py-3 text-center text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
            href="/concierge"
          >
            今の気持ちから神社を探す
          </a>
        </SectionCard>

        <SectionCard
          title="今いる場所の近くの神社"
          description="位置情報をもとに、徒歩圏内の神社を優先して表示します。"
        >
          {/* HomeNearbySection が client でもOK（島として動く） */}
          <HomeNearbySection />
        </SectionCard>

        <SectionCard title="御朱印" description="公開御朱印">
          {hasPublic ? (
            <>
              <div className="my-6 border-t border-slate-200" />
              {/* ✅ “もっと見る”だけ client */}
              <PublicGoshuinsClient results={topResults} />
            </>
          ) : null}
        </SectionCard>
      </div>
    </main>
  );
}
