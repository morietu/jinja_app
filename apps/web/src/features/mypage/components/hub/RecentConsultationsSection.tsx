// apps/web/src/features/mypage/components/hub/RecentConsultationsSection.tsx
"use client";

import Link from "next/link";

import type { ConciergeThread } from "@/lib/api/concierge/types";
import { trackConsultationHistoryEntryClicked } from "@/lib/analytics/consultationHistoryEvents";
import { HUB_PREVIEW_LIMIT, takeHubPreview } from "@/features/mypage/lib/hubPreview";

type Props = {
  threads: ConciergeThread[];
  fetchFailed: boolean;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "日付未記録";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日付未記録";
  return date.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function normalizePreview(value: string | null | undefined): string {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return text || "相談内容はまだ記録されていません。";
}

export default function RecentConsultationsSection({ threads, fetchFailed }: Props) {
  // Backend（GET /api/concierge-threads/）の -last_message_at, -id 順をそのまま使い、
  // Frontend側で別の「最近」ロジックは持たない。
  const visible = takeHubPreview(threads, HUB_PREVIEW_LIMIT);
  const hasThreads = visible.length > 0;

  return (
    <section
      aria-labelledby="mypage-recent-consultations-title"
      className="rounded-2xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] p-5"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="mypage-recent-consultations-title"
          className="text-sm font-medium text-[var(--kt-color-text-secondary)]"
        >
          最近の相談
        </h2>

        {hasThreads ? (
          <Link
            href="/mypage/history"
            // Mypage起点の相談履歴導線。既存のAnalytics契約(source: "mypage")をそのまま維持する。
            onClick={() => trackConsultationHistoryEntryClicked()}
            className="rounded-full border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] px-3 py-1.5 text-xs text-[var(--kt-color-text-secondary)] transition hover:bg-[var(--kt-color-background-subtle)] hover:text-[var(--kt-color-text-primary)]"
          >
            すべて見る
          </Link>
        ) : null}
      </header>

      {fetchFailed ? (
        <p role="alert" className="mt-3 text-sm text-[var(--kt-color-status-error)]">
          相談履歴を読み込めませんでした。
        </p>
      ) : hasThreads ? (
        <ul className="mt-3 space-y-2">
          {visible.map((thread) => (
            <li key={thread.id}>
              <Link
                href={`/mypage/history/${thread.id}`}
                className="block rounded-xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-background-subtle)] p-4 transition hover:bg-[var(--kt-color-surface-default)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-semibold text-[var(--kt-color-text-primary)]">
                    {thread.title?.trim() || "相談タイトル未設定"}
                  </p>
                  <p className="shrink-0 text-xs text-[var(--kt-color-text-muted)]">
                    {formatDate(thread.last_message_at)}
                  </p>
                </div>
                <p className="mt-1 line-clamp-1 text-sm text-[var(--kt-color-text-secondary)]">
                  {normalizePreview(thread.last_message)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 rounded-xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-background-subtle)] p-4">
          <p className="text-sm text-[var(--kt-color-text-secondary)]">まだ相談履歴がありません。</p>
          <Link
            href="/concierge"
            className="mt-3 inline-flex min-h-11 items-center rounded-full border border-[var(--kt-color-action-primary)] bg-[var(--kt-color-action-primary)] px-4 text-sm text-[var(--kt-color-action-primary-text)] transition hover:bg-[var(--kt-color-action-primary-hover)]"
          >
            コンシェルジュに相談する
          </Link>
        </div>
      )}
    </section>
  );
}
