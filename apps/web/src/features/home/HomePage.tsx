"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { HomeNearbySection } from "@/features/home/components/HomeNearbySection";
import { SectionCard } from "@/components/layout/SectionCard";
import MyGoshuinTopSection from "@/features/goshuin/components/MyGoshuinTopSection";

type Goshuin = {
  id: number;
  shrine?: number;
  title?: string | null;
  image_url?: string | null;
  shrine_name?: string | null;
};

type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };

export default function HomePage({ publicGoshuins }: { publicGoshuins: Paginated<Goshuin> | null }) {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8">
        {/* 神社ナビ（既存） */}
        <SectionCard>
          <button
            className="mt-6 w-full rounded-full bg-amber-500 py-3 text-center text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
            onClick={() => router.push("/concierge")}
          >
            今の気持ちから神社を探す
          </button>
        </SectionCard>

        {/* 近くの神社 */}
        <SectionCard
          title="今いる場所の近くの神社"
          description="位置情報をもとに、徒歩圏内の神社を優先して表示します。"
        >
          <HomeNearbySection />
        </SectionCard>

        {/* 御朱印（1ブロック） */}
        <SectionCard title="御朱印" description="あなたの御朱印と、公開御朱印">
          {/* 上：あなたの御朱印 */}
          <MyGoshuinTopSection />

          {/* 下：公開御朱印（あるときだけ） */}
          {publicGoshuins && publicGoshuins.count > 0 && (
            <>
              <div className="my-6 border-t border-slate-200" />

              <div>
                <header className="mb-3 flex items-end justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">みんなの公開御朱印</h3>
                  </div>
                  <Link href="/goshuins/public" className="text-xs text-emerald-700 hover:underline">
                    もっと見る →
                  </Link>
                </header>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {publicGoshuins.results.slice(0, 4).map((g) => {
                    const href = g.shrine ? `/shrines/${g.shrine}` : "/goshuins/public";
                    return (
                      <Link
                        key={g.id}
                        href={href}
                        className="block overflow-hidden rounded-2xl border bg-white shadow-sm hover:opacity-95"
                      >
                        <div className="relative aspect-[4/5] bg-slate-100">
                          {g.image_url ? (
                            <img src={g.image_url} alt={g.title ?? "御朱印"} className="h-full w-full object-cover" />
                          ) : null}
                        </div>

                        <div className="p-3">
                          <div className="truncate text-sm font-medium text-slate-800">{g.title || "（無題）"}</div>
                          {g.shrine_name ? (
                            <div className="truncate text-[11px] text-slate-500">{g.shrine_name}</div>
                          ) : null}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </SectionCard>
      </div>
    </main>
  );
} 
