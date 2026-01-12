// apps/web/src/app/concierge/threads/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchThreadDetail, type ConciergeThreadDetail } from "@/lib/api/concierge";
import RecommendationUnit from "@/components/concierge/RecommendationUnit";


type PageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function ConciergeThreadDetailPage({ params }: PageProps) {
  const { id } = await params;

  // バックエンドの shape に合わせて必要なら ConciergeThreadDetail を調整する
  const data: ConciergeThreadDetail | null = await fetchThreadDetail(id);

  if (!data) {
    // 401/403/404 のときは fetchThreadDetail 側で null を返す想定
    return notFound();
  }

  const { thread, messages, recommendations } = data;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      {/* ヘッダー */}
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{thread.title || "無題のスレッド"}</h1>
          <p className="mt-1 text-xs text-gray-500">コンシェルジュとの会話履歴を確認できます。</p>
        </div>
        <Link href="/concierge/threads" className="text-xs text-blue-600 underline underline-offset-2">
          一覧に戻る
        </Link>
      </header>

      {/* メッセージ一覧（とりあえず素テキスト） */}
      <section className="rounded-lg border bg-white">
        {messages.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-500">まだメッセージがありません。</p>
        ) : (
          <ul className="flex flex-col gap-3 px-4 py-4">
            {messages.map((m) => (
              <li key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[80%]">
                  <div
                    className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "rounded-br-sm bg-emerald-600 text-white"
                        : "rounded-bl-sm bg-gray-100 text-gray-900"
                    }`}
                  >
                    {m.content}
                  </div>
                  <p className={`mt-0.5 text-[10px] text-gray-400 ${m.role === "user" ? "text-right" : "text-left"}`}>
                    {new Date(m.created_at).toLocaleString("ja-JP")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* レコメンド候補のざっくり表示（あれば） */}
      {recommendations && recommendations.length > 0 && (
        <section className="rounded-lg border bg-white px-4 py-4">
          <h2 className="mb-2 text-sm font-semibold">おすすめ候補</h2>
          <div className="space-y-3">
            {recommendations.map((r, idx) => (
              <RecommendationUnit key={r.id ?? r.place_id ?? idx} rec={r as any} index={idx} />
            ))}
          </div>
        </section>
      )}

      {/* 後でここに ChatPanel を置いて「追記できる画面」にする */}
      <section className="rounded-lg border border-dashed px-4 py-6 text-center text-xs text-gray-400">
        ここにチャット入力欄（ChatPanel）を組み込む予定
      </section>
    </div>
  );
}
