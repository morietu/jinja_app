// apps/web/src/app/shrines/hub/[id]/page.tsx
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { parseShrineBackContext, shrineBackConfig } from "@/lib/navigation/shrineBack";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ ctx?: string }>;
};

type ShrineData = {
  id: number;
  name_jp?: string | null;
  address?: string | null;
};

async function fetchShrineData(id: string): Promise<ShrineData | null> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

  const cookie = h.get("cookie") ?? "";
  const res = await fetch(`${baseUrl}/api/shrines/${encodeURIComponent(id)}/data/`, {
    cache: "no-store",
    headers: cookie ? { cookie } : undefined,
  });
  if (!res.ok) return null;
  return (await res.json()) as ShrineData;
}

export default async function ShrineHubPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = (searchParams ? await searchParams : undefined) ?? {};

  const ctx = parseShrineBackContext(sp.ctx);
  const back = shrineBackConfig(ctx);

  const shrineId = Number(id);
  if (!Number.isFinite(shrineId) || shrineId <= 0) {
    return redirect("/map?toast=invalid_shrine");
  }

  const data = await fetchShrineData(id);
  if (!data) redirect("/map?toast=shrine_not_found");

  const title = data.name_jp ?? `神社 #${shrineId}`;
  const address = data.address ?? "";

  return (
    <main className="mx-auto min-h-[calc(100vh-64px)] max-w-md p-4">
      <header className="space-y-1">
        <h1 className="text-lg font-bold text-slate-900">{title}</h1>
        {address ? <p className="text-xs text-slate-500">{address}</p> : null}
        <p className="text-xs text-slate-500">次に何をしますか？</p>
      </header>

      <section className="mt-4 space-y-3">
        <Link
          href={`/shrines/${shrineId}`}
          className="block rounded-2xl border bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm hover:opacity-95"
        >
          神社ページを見る
        </Link>

        <Link
          href={`/mypage?tab=goshuin&shrine=${shrineId}#goshuin-upload`}
          className="block rounded-2xl bg-emerald-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-emerald-500"
        >
          御朱印を登録する
        </Link>

        <Link href={back.href} className="block text-center text-xs text-slate-500 hover:underline">
          {back.label}
        </Link>
      </section>
    </main>
  );
}
