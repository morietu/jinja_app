"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useBilling } from "@/features/billing/hooks/useBilling";
import { startBillingPortal } from "@/lib/api/billing";

const PORTAL_ERROR_MESSAGE =
  "管理画面を開けませんでした。時間をおいて再度お試しください。";

function formatPeriodEnd(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BillingManagePage() {
  const billing = useBilling();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // useBilling の refresh は毎レンダー新しい関数になるので、
  // listener を貼り直さずに済むよう ref 経由で呼ぶ。
  const refreshRef = useRef(billing.refresh);
  refreshRef.current = billing.refresh;

  // Portal から戻ってきたときに Backend（正本）の状態を取り直す。
  // 通常は遷移復帰でこのページが再マウントされるが、bfcache 復元では
  // マウントが走らないので pageshow でも refresh する。
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void refreshRef.current();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const openPortal = async () => {
    try {
      setSubmitting(true);
      setError(null);
      const session = await startBillingPortal();
      window.location.assign(session.portal_url);
    } catch {
      setError(PORTAL_ERROR_MESSAGE);
      setSubmitting(false);
    }
  };

  if (billing.loading) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-6">
        <p className="text-sm text-slate-600">読み込み中…</p>
      </div>
    );
  }

  if (billing.error || !billing.status) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-6">
        <p role="alert" className="text-sm text-red-700">
          プラン状況を取得できませんでした。時間をおいて再度お試しください。
        </p>
        <Link
          href="/billing"
          className="mt-4 inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
        >
          プラン状況に戻る
        </Link>
      </div>
    );
  }

  const { plan, is_active, cancel_at_period_end, current_period_end } = billing.status;
  const isPremiumActive = plan === "premium" && is_active;
  const periodEndLabel = formatPeriodEnd(current_period_end);

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <h1 className="text-base font-semibold text-slate-900">プランを管理</h1>
      <p className="mt-1 text-xs text-slate-600">
        解約・支払い方法の変更はStripeの管理画面で行えます。
      </p>

      <div className="mt-4 rounded-xl border bg-white p-4 shadow-sm">
        <div className="text-xs text-slate-600">現在のプラン</div>
        <div className="mt-1 text-lg font-semibold text-slate-900">
          {isPremiumActive ? "Premium（有効）" : "Free"}
        </div>

        {isPremiumActive && cancel_at_period_end ? (
          <p className="mt-2 text-xs text-slate-700">
            解約予定です。
            {periodEndLabel ? `${periodEndLabel}まではPremiumをご利用いただけます。` : "契約期間の終了まではPremiumをご利用いただけます。"}
          </p>
        ) : null}

        {isPremiumActive && !cancel_at_period_end && periodEndLabel ? (
          <p className="mt-2 text-xs text-slate-700">次回更新日：{periodEndLabel}</p>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        {isPremiumActive ? (
          <button
            type="button"
            onClick={openPortal}
            disabled={submitting}
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "管理画面を準備中…" : "プランを管理"}
          </button>
        ) : (
          <>
            <p className="text-xs text-slate-600">
              現在はFreeプランのため、管理できる契約がありません。
            </p>
            <Link
              href="/billing/upgrade"
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
            >
              プレミアムにする
            </Link>
          </>
        )}

        <div className="flex gap-2">
          <Link
            href="/billing"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
          >
            プラン状況に戻る
          </Link>
          <Link
            href="/concierge"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
          >
            コンシェルジュへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
