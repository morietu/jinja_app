// apps/web/src/components/HomeCards.tsx
// ※ 見出しは出さずに「カードのグリッドだけ」を返す
import Link from "next/link";

const NAV = [
  { title: "AIコンシェルジュ", desc: "現在地や住所から神社提案＋ルート表示", href: "/concierge", cta: "開く" },
  { title: "神社検索", desc: "キーワード・タグで探す（暫定）", href: "/search", cta: "探す" },
  { title: "ランキング", desc: "30日/短期の人気順（暫定）", href: "/ranking", cta: "見る" },
  { title: "マイページ", desc: "お気に入り一覧・履歴（ログイン誘導）", href: "/mypage", cta: "開く" },
];

export default function HomeCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {NAV.map((card) => (
        <div key={card.href} className="rounded border p-4">
          <div className="font-semibold mb-1">{card.title}</div>
          <div className="text-sm text-gray-500 mb-2">{card.desc}</div>
          <Link href={card.href} className="inline-block px-3 py-1 bg-blue-600 text-white rounded">
            {card.cta}
          </Link>
        </div>
      ))}
    </div>
  );
}
