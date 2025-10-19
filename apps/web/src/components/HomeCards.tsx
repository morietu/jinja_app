// apps/web/src/components/HomeCards.tsx
import Link from "next/link";

export default function HomeCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 🟦 特大カード（2カラム分） */}
      <div className="rounded border p-5 sm:col-span-2 bg-gradient-to-br from-blue-50 to-white">
        <div className="text-sm font-medium text-blue-700 mb-1">おすすめ</div>
        <h2 className="text-xl font-bold mb-1">AIコンシェルジュ</h2>
        <p className="text-sm text-gray-600 mb-3">
          現在地や住所から神社を提案。チャット or 地図からルート表示。
        </p>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/concierge"
            className="px-3 py-1.5 rounded bg-blue-600 text-white"
          >
            地図で開く
          </Link>
          <Link
            href="/concierge/chat"
            className="px-3 py-1.5 rounded border border-blue-600 text-blue-700"
          >
            チャットで開く
          </Link>
        </div>
      </div>

      {/* 以降は通常カード */}
      <div className="rounded border p-4">
        <div className="font-semibold mb-1">神社検索</div>
        <div className="text-sm text-gray-500 mb-2">キーワード・タグで探す（暫定）</div>
        <Link href="/search" className="inline-block px-3 py-1 bg-blue-600 text-white rounded">
          探す
        </Link>
      </div>

      <div className="rounded border p-4">
        <div className="font-semibold mb-1">ランキング</div>
        <div className="text-sm text-gray-500 mb-2">30日/短期の人気順（暫定）</div>
        <Link href="/ranking" className="inline-block px-3 py-1 bg-blue-600 text-white rounded">
          見る
        </Link>
      </div>

      <div className="rounded border p-4">
        <div className="font-semibold mb-1">マイページ</div>
        <div className="text-sm text-gray-500 mb-2">お気に入り一覧・履歴（ログイン誘導）</div>
        <Link href="/mypage" className="inline-block px-3 py-1 bg-blue-600 text-white rounded">
          開く
        </Link>
      </div>
    </div>
  );
}
