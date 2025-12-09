// apps/web/src/features/mypage/components/ProfileIconCard.tsx
"use client";

import Image from "next/image";

type Props = {
  iconUrl: string | null | undefined;
  isPublic: boolean;
  // 後でアップロード処理をつなぐとき用（今は見た目だけ）
  onClickChangeIcon?: () => void;
};

export default function ProfileIconCard({ iconUrl, isPublic, onClickChangeIcon }: Props) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 overflow-hidden rounded-full bg-gray-100">
            <Image
              alt="プロフィールアイコン"
              src={iconUrl || "/images/default-avatar.png"}
              fill
              sizes="80px"
              className="object-cover"
            />
          </div>
          <div className="space-y-1 text-xs text-gray-600">
            {/* いまは見た目だけ。onClickChangeIcon は後で使う */}
            <label className="inline-flex cursor-pointer items-center rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
              <input type="file" accept="image/*" className="hidden" onChange={onClickChangeIcon} />
              アイコンを変更
            </label>
            <p className="text-[11px] text-gray-400">画像ファイル（5MB 以下）を選択してください。</p>
          </div>
        </div>
      </div>
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{isPublic ? "公開" : "非公開"}</span>
    </div>
  );
}
