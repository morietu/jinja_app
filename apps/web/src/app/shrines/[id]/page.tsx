"use client"
import dynamic from "next/dynamic";
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { getShrine, Shrine } from "@/lib/api/shrines"

// Map はブラウザAPI依存なので動的 import（SSR 無効)
const Map = dynamic(() => import("@/components/maps/Map"), { ssr: false });


export default function ShrineDetailPage() {
  const params = useParams()
  const raw = params?.id;
  const id = Number(params?.id)

  const [shrine, setShrine] = useState<Shrine | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getShrine(id)
      .then((data) => setShrine(data))
      .catch(() => setError("神社データの取得に失敗しました"))
      .finally(() => setLoading(false));
  }, [id]);

    if (!Number.isFinite(id)) return <p className="p-4">無効なIDです</p>;
    if (loading) return <p className="p-4">読み込み中...</p>;
    if (error) return <p className="p-4 text-red-500">{error}</p>;
    if (!shrine) return <p className="p-4">神社が見つかりません</p>;

    const hasCoords =
      shrine.latitude != null &&
      shrine.longitude != null &&
      !Number.isNaN(Number(shrine.latitude)) &&
      !Number.isNaN(Number(shrine.longitude));

    return (
      <main className="p-4">
        <h1 className="text-2xl font-bold mb-2">{shrine.name_jp}</h1>
        <p className="text-gray-600 mb-4">{shrine.address}</p>



        {shrine.goriyaku && (
          <section className="mb-4">
            <h2 className="font-semibold">ご利益</h2>
            <p>{shrine.goriyaku}</p>
          </section>
        )}

        {shrine.sajin && (
          <section className="mb-4">
            <h2 className="font-semibold">祭神</h2>
            <p>{shrine.sajin}</p>
          </section>
        )}
        {Array.isArray(shrine.goriyaku_tags) && shrine.goriyaku_tags.length > 0 && (
          <section className="mb-4">
            <h2 className="font-semibold">タグ</h2>
            <ul className="flex flex-wrap gap-2 mt-1">
              {shrine.goriyaku_tags.map((tag) => (
                <li
                  key={tag.id}
                  className="px-2 py-1 bg-gray-200 rounded text-sm"
                >
                  {tag.name}
                </li>
              ))}
            </ul>
          </section>
        )}


        {/* --- ✅ Google Maps のルート表示 --- */}
          <section className="mt-6">
            <h2 className="font-semibold mb-2">所在地</h2>

            {hasCoords ? (
              <Map
                lat={Number(shrine.latitude)}
                lon={Number(shrine.longitude)}
                title={shrine.name_jp}
              />
            ) : (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                座標情報が未登録です（住所を編集して保存すると自動付与されます）
              </div>
            )}

          </section>
      </main>
    );
}

