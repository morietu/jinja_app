"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { uploadMyGoshuin } from "@/lib/api/goshuin";

export default function GoshuinUploadForm({ onUploaded }: any) {
  const sp = useSearchParams();

  const shrineId = useMemo(() => {
    const q = sp.get("shrine");
    const n = Number(q);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [sp]);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return setPreviewUrl(null);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setSuccess(null);

    if (!shrineId) {
      setError("神社詳細ページから「御朱印を追加」で来てください。");
      return;
    }
    if (!file) {
      setError("画像ファイルを選択してください。");
      return;
    }

    try {
      setLoading(true);
      const created = await uploadMyGoshuin({
        shrineId,
        title: "",
        isPublic,
        file,
      });

      setSuccess("御朱印をアップロードしました。");
      setFile(null);
      setIsPublic(false);
      onUploaded?.(created);
    } catch {
      setError("アップロードに失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!shrineId && <p className="text-xs text-amber-700">※ 神社が未指定です。神社詳細から来てください。</p>}

      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        公開する
      </label>

      <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border p-4">
        <span>🖼️ 画像を選択</span>
        <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>

      {previewUrl && <Image src={previewUrl} alt="preview" width={400} height={400} unoptimized />}

      <button disabled={!file || !shrineId || loading} className="bg-orange-500 text-white px-4 py-2 rounded">
        {loading ? "アップロード中..." : "アップロード"}
      </button>

      <p className="text-xs text-slate-500">shrineId: {String(shrineId ?? "null")}</p>

      {success && <p className="text-green-700">{success}</p>}
      {error && <p className="text-red-600">{error}</p>}
    </form>
  );
}
