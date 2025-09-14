"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getShrine, type Shrine } from "@/lib/api/shrines";

// Map はブラウザ API 依存なので SSR 無効で読み込み
const Map = dynamic(() => import("@/components/maps/Map"), { ssr: false });

export default function ShrineDetailPage() {
  // id を安全に取り出す（string | string[] の可能性に備える）
  const params = useParams<{ id: string | string[] }>();
  const idParam = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const id = Number(idParam);

  const [shrine, setShrine] = useState<Shrine | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!Number.isFinite(id)) return;
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

      {/* ▼ 御朱印まわりの導線（ここを追加） */}
      <div className="mt-3 mb-6 flex gap-2">
        <Link
          href="/mypage?tab=goshuin"
          className="px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
        >
          御朱印帳
        </Link>
        <Link
          href={`/goshuin/new?shrine=${shrine.id}`}
          className="px-3 py-1 rounded border hover:bg-gray-50"
        >
          ＋御朱印を登録
        </Link>
      </div>

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
              <li key={tag.id} className="px-2 py-1 bg-gray-200 rounded text-sm">
                {tag.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="font-semibold mb-2">所在地</h2>
        {hasCoords ? (
          <Map
            // ※ Map の props が { lat, lng } なら lng に直してください（lon→lng）
            lat={Number(shrine.latitude)}
            lon={Number(shrine.longitude)}
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
