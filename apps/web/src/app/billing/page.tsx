// apps/web/src/app/billing/page.tsx
"use client";

import Link from "next/link";
import { useBilling } from "@/features/billing/hooks/useBilling";

function Spinner() {
  return <div className="py-6 text-center text-sm text-[var(--kt-color-text-secondary)]">読み込み中…</div>;
}
function ErrorView({ message }: { message: string }) {
  return <div className="py-6 text-center text-sm text-red-600">{message}</div>;
}

export default function BillingPage() {
  const billing = useBilling();

  if (billing.loading) return <Spinner />;
  if (billing.error) return <ErrorView message={billing.error} />;
  if (!billing.status) return <Spinner />;

  const { plan, is_active } = billing.status;
  const isPremiumActive = plan === "premium" && is_active;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <h1 className="text-base font-semibold text-[var(--kt-color-text-primary)]">プレミアム</h1>
      <p className="mt-1 text-xs text-[var(--kt-color-text-secondary)]">現在のプラン状況を確認できます。</p>

      <div className="mt-4 rounded-xl border bg-[var(--kt-color-surface-default)] p-4 shadow-sm">
        <div className="text-xs text-[var(--kt-color-text-secondary)]">現在のプラン</div>
        <div className="mt-1 text-lg font-semibold text-[var(--kt-color-text-primary)]">{isPremiumActive ? "Premium（有効）" : "Free"}</div>

        <div className="mt-4 flex gap-2">
          {!isPremiumActive ? (
            <Link
              href="/billing/upgrade"
              className="inline-flex items-center justify-center rounded-md bg-[var(--kt-color-action-primary)] px-3 py-2 text-xs font-semibold text-[var(--kt-color-action-primary-text)]"
            >
              プレミアムにする
            </Link>
          ) : (
            <Link
              href="/billing/manage"
              className="inline-flex items-center justify-center rounded-md bg-[var(--kt-color-action-primary)] px-3 py-2 text-xs font-semibold text-[var(--kt-color-action-primary-text)]"
            >
              プランを管理
            </Link>
          )}

          <Link
            href="/concierge"
            className="inline-flex items-center justify-center rounded-md border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] px-3 py-2 text-xs font-semibold text-[var(--kt-color-text-primary)]"
          >
            コンシェルジュへ戻る
          </Link>
        </div>
      </div>

      <p className="mt-3 text-xs text-[var(--kt-color-text-secondary)]">※ 決済連携はこの後でOK。まずは「状態が見える」ことを優先。</p>
    </div>
  );
}
