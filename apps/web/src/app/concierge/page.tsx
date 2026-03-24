import { Suspense } from "react";
import ConciergeClientSimple from "./ConciergeClientSimple";
import ConciergeClientFull from "./ConciergeClientFull";

function Fallback() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="rounded-2xl border bg-white p-4 text-sm text-slate-600">読み込み中…</div>
    </main>
  );
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: PageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const tidParam = resolvedSearchParams.tid;
  const hasTid = Array.isArray(tidParam) ? tidParam.some((value) => String(value).trim().length > 0) : !!tidParam;

  return (
    <Suspense fallback={<Fallback />}>
      {hasTid ? <ConciergeClientFull /> : <ConciergeClientSimple />}
    </Suspense>
  );
}
