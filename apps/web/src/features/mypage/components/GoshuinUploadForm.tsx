/* eslint-disable @next/next/no-img-element */
// apps/web/src/features/mypage/components/GoshuinUploadForm.tsx
"use client";

import { FormEvent, useState, useEffect } from "react";
import type { Goshuin } from "@/lib/api/goshuin";
import { uploadMyGoshuin } from "@/lib/api/goshuin";
// import { ImagePlus } from "lucide-react"; // ★ アイコン追加
// import { SomethingElse } from "lucide-react";

type Props = {
  onUploaded?: (goshuin: Goshuin) => void;
};

export default function GoshuinUploadForm({ onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inputId = "goshuin-image";

  // file が変わるたびにプレビュー URL を作る
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

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

    try {
      setLoading(true);

      const created = await uploadMyGoshuin({
        shrineId: 1,
        title: "",
        isPublic: true,
        file,
      });

      setSuccessMessage("御朱印をアップロードしました。");
      setFile(null);
      if (onUploaded) onUploaded(created);
    } catch (err: any) {
      console.error("uploadMyGoshuin failed", err);
      setErrorMessage("アップロードに失敗しました。時間をおいて再度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 説明エリア */}
      <div className="space-y-1 text-sm">
        <p className="font-medium">スマホで撮った御朱印の写真をアップロードして、マイページに保存できます。</p>
        <p className="text-xs text-muted-foreground">御朱印画像は 5MB までの jpg / png ファイルに対応しています。</p>
      </div>

      {/* ファイル入力 */}
      <div>
        <label htmlFor={inputId} className="flex cursor-pointer flex-col items-center justify-center ...">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
            <span className="text-lg" aria-hidden="true">
              🖼️
            </span>
          </div>

          <div className="space-y-1 mt-2 text-center">
            <p className="text-sm font-medium">{file ? "画像を変更する" : "画像を選択する"}</p>
            <p className="text-[11px] text-muted-foreground">
              {file ? `選択中: ${file.name}` : "タップして御朱印の写真を選んでください"}
            </p>
          </div>
        </label>

        <input
          id={inputId}
          type="file"
          accept="image/*"
          aria-label="御朱印画像"
          disabled={loading}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            // ここで previewUrl をセットしているなら、そのまま維持
          }}
          className="hidden"
        />
      </div>

      {/* プレビュー */}
      {previewUrl && (
        <div className="mb-4">
          <p className="mb-1 text-xs font-medium text-muted-foreground">プレビュー</p>
          <div className="inline-flex rounded-xl border border-gray-100 bg-gray-50 p-2">
            <img src={previewUrl} alt="選択中の御朱印プレビュー" className="h-32 w-auto rounded-lg object-contain" />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !file}
        className="px-4 py-2 text-sm font-medium rounded-md bg-orange-500 text-white disabled:opacity-50"
      >
        {loading ? "アップロード中..." : "アップロードする"}
      </button>

      {/* メッセージ */}
      {successMessage && <p className="text-sm text-green-700">{successMessage}</p>}
      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}
