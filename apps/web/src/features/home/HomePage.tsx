import { HomeToastClient } from "@/features/home/components/HomeToastClient";
import { HomeMainClient } from "@/features/home/components/HomeMainClient";

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
  const topResults = results.slice(0, 9);

  return (
    <div className="h-full min-h-0 bg-slate-50">
      <HomeToastClient />
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8">
        <HomeMainClient publicResults={topResults} />
      </div>
    </div>
  );
}
