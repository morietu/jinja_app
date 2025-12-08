"use client";

import { useState } from "react";
import Image from "next/image";
import { uploadUserIcon, type UserMe } from "@/lib/api/users";
import { useAuth } from "@/lib/hooks/useAuth";

type Props = {
  user: UserMe;
};

export default function ProfileIconUploader({ user }: Props) {
  const { refresh } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const iconSrc = user.icon ?? "/images/default-avatar.png"; // デフォルトアイコンは好きなパスに

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    await uploadUserIcon(file); // ★ ここで /api/users/me/icon/ を叩く
    await refresh(); // ★ me を再取得（useAuth 内で /api/users/me/）
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-20 w-20 overflow-hidden rounded-full bg-gray-100">
        <Image src={iconSrc} alt="プロフィールアイコン" fill sizes="80px" className="object-cover" />
      </div>

      <div className="space-y-1 text-xs text-gray-600">
        <label className="inline-flex cursor-pointer items-center rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploading} />
          {uploading ? "アップロード中..." : "アイコンを変更"}
        </label>
        <p className="text-[11px] text-gray-400">画像ファイル（5MB 以下）を選択してください。</p>
        {error && <p className="text-[11px] text-red-500">{error}</p>}
      </div>
    </div>
  );
}
