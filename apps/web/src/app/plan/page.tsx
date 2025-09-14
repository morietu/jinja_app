// apps/web/src/app/plan/page.tsx
import PlanView from "./PlanView";

type SP = Record<string, string | string[] | undefined>;
export type PageProps = {
  searchParams?: Promise<SP>; // ★ Next 15 の生成型に合わせて Promise 前提
};

export default async function Page({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : undefined;

  // 便利関数：?key=a&key=b → 最初の1件を返す
  const first = (v: string | string[] | undefined) =>
    typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;

  // ここで必要なクエリを抜き出して props に渡す（例）
  const initialQuery = {
    q: first(sp?.q),
    tab: first(sp?.tab),
    page: Number.isFinite(Number(first(sp?.page))) ? Number(first(sp?.page)) : 1,
    // 必要なら他のキーもここで取り出す:
    // date: first(sp?.date),
    // from: first(sp?.from),
    // to: first(sp?.to),
    // tags: Array.isArray(sp?.tags) ? sp!.tags as string[] : first(sp?.tags) ? [first(sp?.tags)!] : [],
  };

  return <PlanView initialQuery={initialQuery} />;
}
