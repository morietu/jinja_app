// apps/web/src/features/mypage/components/GoshuinUploadForm.tsx
"use client";

import { FormEvent, useState } from "react";
import type { Goshuin } from "@/lib/api/goshuin";
import { uploadMyGoshuin } from "@/lib/api/goshuin";

type Props = {
  onUploaded?: (goshuin: Goshuin) => void;
};

export default function GoshuinUploadForm({ onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inputId = "goshuin-image"; // ★ 追加

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!file) {
      setErrorMessage("画像ファイルを選択してください。");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrorMessage("画像ファイルのみアップロードできます。");
      return;
    }

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      setErrorMessage("ファイルサイズは 5MB 以下を推奨しています。");
      return;
    }

    const formData = new FormData();
    formData.append("image", file);

    try {
      setLoading(true);
      const created = await uploadMyGoshuin(formData);
      setSuccessMessage("御朱印をアップロードしました。");
      setFile(null);
      if (onUploaded) onUploaded(created);
    } catch {
      setErrorMessage("アップロードに失敗しました。時間をおいて再度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label
          htmlFor={inputId} // ★ 追加
          className="block text-sm font-medium"
        >
          御朱印画像
        </label>
        <p className="text-xs text-muted-foreground">推奨サイズ：5MB 以下の画像ファイル</p>
        <input
          id={inputId} // ★ 追加
          type="file"
          accept="image/*"
          disabled={loading}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
          }}
          className="block text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !file}
        className="px-4 py-2 text-sm rounded-md border border-gray-300 disabled:opacity-50"
      >
        {loading ? "アップロード中..." : "アップロード"}
      </button>

      {successMessage && <p className="text-sm text-green-700">{successMessage}</p>}
      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}
