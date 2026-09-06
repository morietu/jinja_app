"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { buildLoginHref } from "@/lib/nav/login";
import { isExplanationOnlyFactSource, pickReasonV4Fact } from "@/features/concierge/reasonV4FactPriority";
import {
  trackConsultationHistoryDetailViewed,
  trackConsultationHistoryShrineOpened,
} from "@/lib/analytics/consultationHistoryEvents";
import type { ConciergeThreadDetail, ConciergeRecommendation } from "@/lib/api/concierge/types";

type Props = {
  tid: string;
  thread: ConciergeThreadDetail | null;
  fetchFailed: boolean;
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "日時未記録";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日時未記録";
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ACTION_STATE_LABEL: Record<string, string> = {
  saved: "気になる登録済み",
  visited: "参拝済み",
  reflected: "振り返り済み",
};

function extractShrineId(rec: ConciergeRecommendation): number | null {
  const raw = rec.shrine_id ?? rec.id;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function RecommendationCard({
  rec,
  tid,
  rank,
}: {
  rec: ConciergeRecommendation;
  tid: string;
  rank: number;
}) {
  const shrineId = extractShrineId(rec);
  // Ranking / Runtime EvidenceとExplanation-only Knowledge Fact(deity/shrine_history)を
  // 分離する(reasonV4FactPriority.tsの共通契約、buildHeroReasonV4Sections.tsと同じ境界。
  // App-wide Evidence & Dark UI Regression Audit Bug-2修正)。
  const pickedFact = pickReasonV4Fact(rec.recommendation_reason_v4_detail?.fact);
  const isPickedFactExplanationOnly = pickedFact ? isExplanationOnlyFactSource(pickedFact.source) : false;
  const factText = pickedFact && !isPickedFactExplanationOnly ? pickedFact.text : null;
  const explanationOnlyFactText = pickedFact && isPickedFactExplanationOnly ? pickedFact.text : null;
  const actionLabel = rec.action_state ? ACTION_STATE_LABEL[rec.action_state] : null;

  return (
    <li className="rounded-2xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-background-subtle)] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-[var(--kt-color-text-primary)]">{rec.name}</p>
        {actionLabel ? (
          <span className="shrink-0 rounded-full border border-emerald-700/20 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
            {actionLabel}
          </span>
        ) : null}
      </div>
      {rec.address ? <p className="mt-1 text-xs text-[var(--kt-color-text-muted)]">{rec.address}</p> : null}
      {factText ? <p className="mt-2 text-sm text-[var(--kt-color-text-secondary)]">{factText}</p> : null}
      {explanationOnlyFactText ? (
        <p
          className="mt-2 text-sm text-[var(--kt-color-text-muted)]"
          data-testid="consultation-history-explanation-only-fact"
        >
          <span className="font-semibold">参考情報: </span>
          {explanationOnlyFactText}
        </p>
      ) : null}
      {shrineId != null ? (
        <Link
          href={`/shrines/${shrineId}?ctx=concierge&tid=${encodeURIComponent(tid)}`}
          onClick={() =>
            trackConsultationHistoryShrineOpened({ threadId: tid, shrineId, recommendationRank: rank })
          }
          className="mt-3 inline-block text-xs font-semibold text-[var(--kt-color-action-primary)] underline"
        >
          神社の詳細を見る
        </Link>
      ) : null}
    </li>
  );
}

export default function ConsultationHistoryDetailView({ tid, thread, fetchFailed }: Props) {
  const { loading, isLoggedIn } = useAuth();
  const router = useRouter();

  // 認証済みかつ取得成功でthreadが正常表示された時点で、同一tidの同一マウント中に1回だけ発火する。
  const trackedDetailViewTidRef = useRef<string | null>(null);
  useEffect(() => {
    if (loading || !isLoggedIn || fetchFailed || !thread) return;
    if (trackedDetailViewTidRef.current === tid) return;
    trackedDetailViewTidRef.current = tid;

    const recommendations = thread.recommendations_v2 ?? thread.recommendations ?? [];
    trackConsultationHistoryDetailViewed({
      threadId: thread.id,
      recommendationCount: recommendations.length,
      messageCount: thread.messages.length,
    });
  }, [loading, isLoggedIn, fetchFailed, thread, tid]);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl p-6 text-[var(--kt-color-text-primary)]">
        <p className="text-sm text-[var(--kt-color-text-muted)]">読み込み中…</p>
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <main className="mx-auto max-w-3xl p-6 text-[var(--kt-color-text-primary)]">
        <h1 className="mb-4 text-xl font-semibold">相談履歴</h1>
        <div className="rounded-2xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-background-subtle)] p-6">
          <p className="mb-3 text-sm text-[var(--kt-color-text-secondary)]">ログインすると、この相談履歴を見返せます。</p>
          <Link
            href={buildLoginHref(`/mypage/history/${tid}`)}
            className="inline-block rounded-full bg-[var(--kt-color-action-primary)] px-4 py-2 text-sm text-[var(--kt-color-background-base)] transition hover:bg-[var(--kt-color-action-primary-hover)]"
          >
            ログインへ
          </Link>
        </div>
      </main>
    );
  }

  if (fetchFailed) {
    return (
      <main className="mx-auto max-w-3xl p-6 text-[var(--kt-color-text-primary)]">
        <div className="rounded-2xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-background-subtle)] p-6">
          <p className="mb-3 text-sm text-[var(--kt-color-status-error)]">相談履歴を読み込めませんでした。</p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="inline-block rounded-full border border-[var(--kt-color-border-strong)] bg-[var(--kt-color-surface-default)] px-4 py-2 text-sm text-[var(--kt-color-text-primary)] transition hover:bg-[var(--kt-color-background-subtle)]"
          >
            もう一度読み込む
          </button>
        </div>
      </main>
    );
  }

  if (!thread) {
    return (
      <main className="mx-auto max-w-3xl p-6 text-[var(--kt-color-text-primary)]">
        <div className="rounded-2xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-background-subtle)] p-6">
          <p className="text-sm text-[var(--kt-color-text-secondary)]">この相談は見つかりませんでした。</p>
          <Link
            href="/mypage/history"
            className="mt-3 inline-block text-sm text-[var(--kt-color-action-primary)] underline"
          >
            相談履歴の一覧へ戻る
          </Link>
        </div>
      </main>
    );
  }

  const recommendations = thread.recommendations_v2 ?? thread.recommendations ?? [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 text-[var(--kt-color-text-primary)]">
      <div>
        <Link href="/mypage/history" className="text-xs text-[var(--kt-color-text-muted)] underline">
          ← 相談履歴の一覧へ
        </Link>
        <h1 className="mt-2 text-xl font-semibold">{thread.title?.trim() || "相談タイトル未設定"}</h1>
        <p className="mt-1 text-xs text-[var(--kt-color-text-muted)]">{formatDateTime(thread.last_message_at)}</p>
      </div>

      {recommendations.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--kt-color-text-secondary)]">当時推薦された神社</h2>
          <ul className="space-y-3">
            {recommendations.map((rec, idx) => (
              <RecommendationCard
                key={`${extractShrineId(rec) ?? rec.name}-${idx}`}
                rec={rec}
                tid={tid}
                rank={idx + 1}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-[var(--kt-color-text-secondary)]">相談内容</h2>
        <ul className="space-y-2">
          {thread.messages.map((message) => (
            <li
              key={message.id}
              className={
                message.role === "user"
                  ? "rounded-2xl bg-[var(--kt-color-message-own-background)] p-3 text-sm text-[var(--kt-color-message-own-text)]"
                  : "rounded-2xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] p-3 text-sm text-[var(--kt-color-text-primary)]"
              }
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              <p className="mt-1 text-xs text-[var(--kt-color-text-muted)]">{formatDateTime(message.created_at)}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
