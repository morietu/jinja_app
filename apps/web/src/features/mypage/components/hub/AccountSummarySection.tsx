// apps/web/src/features/mypage/components/hub/AccountSummarySection.tsx
"use client";

type Props = {
  displayName: string;
  email: string | null;
  isPremium: boolean;
};

export default function AccountSummarySection({ displayName, email, isPremium }: Props) {
  // FREEはneutral、Premiumは既存のpremium tokenで軽く強調するだけに留める（広告的な強調はしない）。
  const planBadgeClass = isPremium
    ? "border-[var(--kt-color-premium-border)] bg-[var(--kt-color-premium-surface)] text-[var(--kt-color-premium-accent)]"
    : "border-[var(--kt-color-border-default)] bg-[var(--kt-color-background-subtle)] text-[var(--kt-color-text-secondary)]";

  return (
    <section
      aria-labelledby="mypage-account-summary-title"
      className="rounded-2xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] p-5"
    >
      <h2 id="mypage-account-summary-title" className="text-sm font-medium text-[var(--kt-color-text-secondary)]">
        アカウント
      </h2>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-lg font-semibold text-[var(--kt-color-text-primary)]">{displayName}</p>
        <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${planBadgeClass}`}>
          {isPremium ? "Premium" : "FREE"}
        </span>
      </div>

      {email ? <p className="mt-1 break-all text-sm text-[var(--kt-color-text-muted)]">{email}</p> : null}
    </section>
  );
}
