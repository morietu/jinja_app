// apps/web/src/app/g/[username]/page.tsx
import { notFound } from "next/navigation";

type Props = { params: { username: string } };

type Goshuin = {
  id: number;
  title?: string | null;
  image_url?: string | null;
  shrine_name?: string | null;
  is_public: boolean;
};

async function fetchPublicGoshuins(username: string): Promise<Goshuin[]> {
  const res = await fetch(`/api/public/goshuins/${encodeURIComponent(username)}`, {
    cache: "no-store",
  });

  if (res.status === 404) notFound();
  if (!res.ok) throw new Error("failed");
  return (await res.json()) as Goshuin[];

  
}

function Card({ g }: { g: Goshuin }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="aspect-[4/5] bg-slate-100">
        {g.image_url ? (
          
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

export default async function PublicGoshuinPage({ params }: Props) {
  const { username } = params;

  let items: Goshuin[] = [];
  try {
    items = await fetchPublicGoshuins(username);
  } catch {
    // 500系は一旦 404 扱いでもOK（運用方針次第）
    notFound();
  }

  const latest = items.slice(0, 12); // とりあえず 12 でも良い。トップ用に 4 にするなら 4

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900">@{username} の御朱印帳</h1>
        <p className="mt-1 text-xs text-slate-500">公開されている御朱印のみ表示します。</p>
      </header>

      {latest.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600">公開されている御朱印がありません。</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {latest.map((g) => (
            <Card key={g.id} g={g} />
          ))}
        </div>
      )}
    </main>
  );
}
