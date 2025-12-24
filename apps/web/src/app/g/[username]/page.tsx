import Link from "next/link";
import { notFound } from "next/navigation";
import PublicGoshuinHeader from "./PublicGoshuinHeader";
import type { Metadata } from "next";


type Props = {
  params: Promise<{ username: string }>;
  searchParams?: Promise<{ offset?: string; limit?: string }>;
};

type Goshuin = {
  id: number;
  title?: string | null;
  image_url?: string | null;
  shrine_name?: string | null;
  is_public: boolean;
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

async function fetchPublicGoshuins(username: string, limit: number, offset: number): Promise<Paginated<Goshuin>> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/public/goshuins/${encodeURIComponent(username)}?limit=${limit}&offset=${offset}`,
    { cache: "no-store" },
  );

  if (res.status === 404) {
    return { count: 0, next: null, previous: null, results: [] };
  }
  if (!res.ok) throw new Error("failed");

  return (await res.json()) as Paginated<Goshuin>;
}

function Card({ g }: { g: Goshuin }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="aspect-[4/5] bg-slate-100">
        {g.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={g.image_url} alt={g.title ?? "御朱印"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">画像なし</div>
        )}
      </div>
      <div className="p-3">
        <div className="truncate text-sm font-medium text-slate-800">{g.title || "（無題）"}</div>
        <div className="truncate text-[11px] text-slate-500">{g.shrine_name || ""}</div>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;

  const title = `@${username} の御朱印帳 | 神社ナビ`;
  const description = "公開している御朱印をまとめて見られます。";

  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ?? "https://jinja-app-web.vercel.app";

  const ogImage = `${siteUrl}/ogp/goshuin.png?v=2`; // ← v=2 はXキャッシュ対策
  const url = `${siteUrl}/g/${encodeURIComponent(username)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      images: [{ url: ogImage }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function PublicGoshuinPage({ params, searchParams }: Props) {
  const { username } = await params;

  const sp = (await searchParams) ?? {};
  const limit = Math.max(1, Math.min(48, Number(sp.limit ?? 12) || 12));
  const offset = Math.max(0, Number(sp.offset ?? 0) || 0);


  let data: Paginated<Goshuin>;
  try {
    data = await fetchPublicGoshuins(username, limit, offset);
  } catch {
    notFound();
  }

  const items = data.results ?? [];
  const prevOffset = Math.max(0, offset - limit);
  const nextOffset = offset + limit;

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <PublicGoshuinHeader username={username} count={data.count} limit={limit} offset={offset} />

      {items.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600">公開されている御朱印がありません。</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {items.map((g) => (
              <Card key={g.id} g={g} />
            ))}
          </div>

          <nav className="flex items-center justify-between pt-2">
            {data.previous ? (
              <Link
                href={`/g/${encodeURIComponent(username)}?limit=${limit}&offset=${prevOffset}`}
                className="text-sm text-blue-600 underline"
              >
                ← 前へ
              </Link>
            ) : (
              <span />
            )}

            {data.next ? (
              <Link
                href={`/g/${encodeURIComponent(username)}?limit=${limit}&offset=${nextOffset}`}
                className="text-sm text-blue-600 underline"
              >
                次へ →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </>
      )}
    </main>
  );
}
