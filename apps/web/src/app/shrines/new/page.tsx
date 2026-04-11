"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth/AuthProvider";
import { ShrineSubmissionForm } from "@/features/shrine-submission/components/ShrineSubmissionForm";
import type { ShrineSubmissionResponse } from "@/features/shrine-submission/types";

export default function NewShrinePage() {
  const router = useRouter();
  const { isLoggedIn, loading } = useAuth();
  const [submitted, setSubmitted] = useState<ShrineSubmissionResponse | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!isLoggedIn) {
      router.replace("/auth/login?returnTo=/shrines/new");
    }
  }, [isLoggedIn, loading, router]);

  if (loading || !isLoggedIn) {
    return <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-slate-500">認証状態を確認しています...</div>;
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs text-emerald-700">投稿完了</p>
          <h1 className="mt-2 text-base font-semibold text-slate-900">神社登録の投稿を受け付けました</h1>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            投稿内容は現在審査中です。承認されるまで一般公開はされません。
          </p>

          <dl className="mt-6 space-y-3 text-sm text-slate-700">
            <div>
              <dt className="text-xs text-slate-500">神社名</dt>
              <dd>{submitted.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">住所</dt>
              <dd>{submitted.address || "未入力"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">状態</dt>
              <dd>{submitted.status}</dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className="rounded-xl bg-emerald-600 px-4 py-3 text-sm text-white"
              onClick={() => router.push("/mypage")}
            >
              マイページへ戻る
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
              onClick={() => router.push("/")}
            >
              トップへ戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs text-emerald-700">Shrine Submission</p>
        <h1 className="mt-2 text-base font-semibold text-slate-900">神社を追加する</h1>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          神社名・住所・ご利益タグ・補足文をもとに審査され、承認後に神社データへ反映されます。
        </p>
      </div>

      <ShrineSubmissionForm
        onSubmitted={setSubmitted}
        onRequireAuth={() => router.replace("/auth/login?returnTo=/shrines/new")}
      />
    </div>
  );
}
