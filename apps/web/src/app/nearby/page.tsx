// Next.js App Router のページ
import NearbyShrines from "@/components/NearbyShrines";

export default function NearbyPage() {
  return (
    <main style={{ padding: 16 }}>
      <h1>あなたの近くの神社</h1>
      <p>ブラウザの位置情報の許可が必要です。</p>
      <NearbyShrines limit={10} />
    </main>
  );
}
