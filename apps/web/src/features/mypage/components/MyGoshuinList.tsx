// apps/web/src/features/mypage/components/MyGoshuinList.tsx
"use client";

import Image from "next/image";
import type { Goshuin } from "@/lib/api/goshuin";

type Props = {
  items: Goshuin[] | null;
  loading: boolean;
  error: string | null;
};

export default function MyGoshuinList({ items, loading, error }: Props) {
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-4 w-32 rounded bg-gray-100" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-lg border p-3">
              <div className="mb-2 h-20 w-full rounded bg-gray-100" />
              <div className="h-3 w-3/4 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!items || items.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        まだ御朱印が登録されていません。上のフォームから最初の1枚をアップロードしてみてください。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-700">登録済みの御朱印</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((g) => (
          <div key={g.id} className="rounded-lg border bg-white p-2 text-xs">
            {g.image_url ? (
              <div className="relative mb-2 aspect-[3/4] overflow-hidden rounded">
                <Image
                  src={g.image_url}
                  alt={g.shrine_name ? `${g.shrine_name}の御朱印` : "御朱印"}
                  fill
                  sizes="(max-width: 640px) 50vw, 33vw"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="mb-2 flex aspect-[3/4] items-center justify-center rounded bg-gray-50">画像なし</div>
            )}

            <div className="space-y-1">
              <p className="font-medium truncate">{g.shrine_name ?? "神社名なし"}</p>
              {g.created_at && (
                <p className="text-[10px] text-gray-500">
                  登録日: {new Date(g.created_at).toLocaleDateString("ja-JP")}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
