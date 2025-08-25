import Link from "next/link"

export default function NavBar() {
  return (
    <nav className="flex gap-4 p-4 bg-gray-100">
      <Link href="/">検索</Link>
      <Link href="/ranking">ランキング</Link> {/* ← 追加 */}
      <Link href="/mypage">マイページ</Link>
    </nav>
  )
}
