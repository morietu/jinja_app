// apps/web/src/features/mypage/components/SettingsSection.tsx
"use client";

import { useState } from "react";
import type { MouseEvent } from "react";
import { updateProfileVisibility } from "@/lib/api/mypage";

type Props = {
  initialIsPublic: boolean;
};

export default function SettingsSection({ initialIsPublic }: Props) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (pending) return;

    const next = !isPublic;
    setPending(true);
    setError(null);
    setIsPublic(next); // 楽観的更新

    try {
      await updateProfileVisibility(next);
    } catch (err) {
      // 失敗したらロールバック
      setIsPublic((prev) => !prev);
      setError("保存に失敗しました。時間をおいて再度お試しください。");
      console.error("updateProfileVisibility failed", err);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">公開プロフィール</p>
            <p className="text-sm text-gray-500">
              プロフィールを公開すると、他のユーザーもあなたのページを閲覧できます。
            </p>
          </div>

          <button
            type="button"
            onClick={handleToggle}
            disabled={pending}
            aria-pressed={isPublic}
            className={
              "inline-flex items-center rounded-full border px-3 py-1 text-sm transition " +
              (isPublic
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50")
            }
          >
            {isPublic ? "公開中" : "非公開"}
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="space-y-2 rounded-lg border p-4">
        <p className="font-medium">プロフィール</p>
        <p className="text-sm text-gray-500">表示名や自己紹介、SNS リンクなどを編集できます。</p>
        <a href="/mypage/edit" className="inline-flex items-center text-sm text-blue-600 hover:underline">
          プロフィールを編集する
        </a>
      </div>
    </div>
  );
}
