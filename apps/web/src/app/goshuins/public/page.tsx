// apps/web/src/app/goshuins/public/page.tsx
import Link from "next/link";
import { headers } from "next/headers";

type Goshuin = {
  id: number;
  shrine: number;
  title?: string | null;
  image_url?: string | null;
  shrine_name?: string | null;
  is_public: boolean;
  created_at?: string;
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export const metadata = {
  title: "公開御朱印 | Jinja",
  description: "公開されている御朱印だけを一覧で見られます。",
  openGraph: {
    title: "公開御朱印 | Jinja",
    description: "公開されている御朱印だけを一覧で見られます。",
    images: [{ url: "/ogp/goshuin-1200x630.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "公開御朱印 | Jinja",
    description: "公開されている御朱印だけを一覧で見られます。",
    images: ["/ogp/goshuin-1200x630.png"],
  },
};

export default async function PublicGoshuinsPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string; offset?: string }>;
}) {
  const sp = await searchParams;

  const limit = Math.max(1, Math.min(48, Number(sp.limit ?? "12") || 12));
  const offset = Math.max(0, Number(sp.offset ?? "0") || 0);

  // サーバーで相対URL fetch は不可なので host から絶対URLを組む
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

  const res = await fetch(`${baseUrl}/api/public/goshuins?limit=${limit}&offset=${offset}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    return <pre className="p-6 text-sm">{text}</pre>;
  }

  const data = (await res.json()) as Paginated<Goshuin>;

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">公開御朱印</h1>
          <p className="mt-1 text-xs text-slate-500">公開されている御朱印だけを表示します。</p>
        </div>
        <div className="text-xs text-slate-500">
          {offset + 1}-{Math.min(offset + limit, data.count)} / {data.count}
        </div>
      </header>

      {data.count === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600">公開御朱印がありません。</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {data.results.map((g) => {
            const href = g.shrine ? `/shrines/${g.shrine}` : "/search";
            return (
              <Link
                key={g.id}
                href={href}
                className="block overflow-hidden rounded-2xl border bg-white shadow-sm hover:opacity-95"
                aria-label={`${g.shrine_name ?? "神社"} のページへ`}
              >
                <div className="aspect-[4/5] bg-slate-100">
                  {g.image_url ? (
                    <img src={g.image_url} alt={g.title ?? "御朱印"} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="p-3">
                  <div className="truncate text-sm font-medium text-slate-800">{g.title || "（無題）"}</div>
                  <div className="truncate text-[11px] text-slate-500">{g.shrine_name || ""}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <nav className="flex items-center justify-between pt-2">
        {data.previous ? (
          <Link className="rounded-md bg-slate-100 px-3 py-2 text-xs hover:bg-slate-200" href={data.previous}>
            ← 前へ
          </Link>
        ) : (
          <span />
        )}
        {data.next ? (
          <Link className="rounded-md bg-slate-100 px-3 py-2 text-xs hover:bg-slate-200" href={data.next}>
            次へ →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
