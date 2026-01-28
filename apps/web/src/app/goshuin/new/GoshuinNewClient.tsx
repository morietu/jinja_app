"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { uploadMyGoshuin, fetchMyGoshuinCount, type GoshuinCount } from "@/lib/api/goshuin";
import Image from "next/image";

function safeDecode(v: string) {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

function firstNonEmpty(...xs: Array<string | null | undefined>) {
  for (const x of xs) {
    const t = (x ?? "").trim();
    if (t) return t;
  }
  return "";
}

export default function GoshuinNewClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const from = useMemo(() => sp.get("from"), [sp]);
  const shrine = useMemo(() => sp.get("shrine"), [sp]);

  const shrineId = useMemo(() => {
    const n = Number(shrine);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [shrine]);

  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(true);

  // ✅ 枚数カウント（初回ロードで1回）
  const [count, setCount] = useState<GoshuinCount | null>(null);
  const [countLoading, setCountLoading] = useState(true);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setCountLoading(true);
        const c = await fetchMyGoshuinCount();
        if (alive) setCount(c);
      } catch {
        // 認証切れ等は submit で分かるので、ここでは黙っておく（表示だけ）
        if (alive) setCount(null);
      } finally {
        if (alive) setCountLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  React.useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const goNext = () => {
    if (from) {
      router.push(safeDecode(from));
      return;
    }
    if (shrineId) {
      router.push(`/shrines/${shrineId}#goshuins`);
      return;
    }
    router.push("/mypage?tab=goshuin");
  };

  
  const limitLabel = countLoading
    ? "御朱印数を確認中…"
    : count
      ? `御朱印 ${count.count}/${count.limit}（残り${count.remaining}）`
      : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!shrineId) {
      setError("神社が指定されていません。神社詳細ページから登録してください。");
      return;
    }
    if (!file) {
      setError("御朱印画像を選択してください。");
      return;
    }

    try {
      setBusy(true);

      // ✅ submit直前に再チェック（競合/別端末で増えてても安全）
      const c = await fetchMyGoshuinCount();
      setCount(c);

      if (!c.can_add) {
        setError(`御朱印は ${c.count}/${c.limit} までです（残り ${c.remaining}）。プランを更新してください。`);
        return;
      }

      await uploadMyGoshuin({
        shrineId,
        title: firstNonEmpty(title, ""),
        isPublic,
        file,
      });

      goNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-4 p-4">
      <div className="space-y-1">
        <h1 className="text-lg font-bold">御朱印を登録</h1>
        <p className="text-xs text-slate-500">
          {shrineId ? `神社ID: ${shrineId}` : "神社が未指定です（神社詳細から来る想定）"}
        </p>

        {limitLabel ? (
          <div className="rounded-xl border bg-white px-3 py-2 text-xs text-slate-700">{limitLabel}</div>
        ) : null}

        {!countLoading && count && !count.can_add ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            上限に達しています。
            <Link href="/billing/upgrade" className="underline font-semibold">
              プランを更新
            </Link>
          </div>
        ) : null}
      </div>

      {/* 画像 */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">御朱印画像</label>

        {previewUrl ? (
          <div className="overflow-hidden rounded-2xl border bg-white">
            // eslint-disable-next-line @next/next/no-img-element
            <Image src={previewUrl} alt="preview" width={800} height={800} className="h-auto w-full object-contain" />
          </div>
        ) : (
          <div className="rounded-2xl border bg-slate-50 p-4 text-xs text-slate-600">
            まだ画像が選択されていません（スマホはカメラが起動します）
          </div>
        )}

        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={busy || (!countLoading && count?.can_add === false)}
          className="block w-full text-sm"
          aria-label="御朱印画像"
        />
        <p className="text-[11px] text-slate-500">推奨：5MB以下。あとで公開/非公開は変更できます。</p>
      </div>

      {/* タイトル */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">タイトル（任意）</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={busy || (!countLoading && count?.can_add === false)}
          placeholder="例：2026/01/24 初詣"
          className="w-full rounded-xl border px-3 py-2 text-sm"
        />
      </div>

      {/* 公開設定 */}
      <div className="flex items-center justify-between rounded-xl border bg-white px-3 py-3">
        <div className="space-y-0.5">
          <div className="text-sm font-semibold">公開する</div>
          <div className="text-xs text-slate-500">公開御朱印として神社詳細などに表示されます</div>
        </div>
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          disabled={busy || (!countLoading && count?.can_add === false)}
          className="h-5 w-5"
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 space-y-2">
          <div>{error}</div>
          {error.includes("プラン") ? (
            <Link href="/billing/upgrade" className="underline font-semibold">
              プランを更新する
            </Link>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        disabled={busy || (!countLoading && count?.can_add === false)}
      >
        {busy ? "登録中…" : "この内容で登録する"}
      </button>

      <button
        type="button"
        className="w-full rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-60"
        disabled={busy}
        onClick={goNext}
      >
        戻る
      </button>
    </form>
  );
}
