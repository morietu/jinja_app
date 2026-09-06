"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { isSubmissionPendingParams } from "@/features/shrine-submission/lib/submissionReturnState";

import { ShrineCard } from "@/components/shrines/ShrineCard";
import type { ShrineCardAdapterProps } from "@/components/shrine/buildShrineCardProps";
import { fetchShrines } from "@/lib/api/shrinesSearch";
import { getGoriyakuTags, type GoriyakuTag } from "@/lib/api/tags";
import { buildShrineListCardModel } from "@/lib/shrine/buildShrineListCardModel";
import { trackSearchEvent } from "@/lib/analytics/searchEvents";
import { HISTORY_THEME_TAGS, VISIT_STYLE_TAGS } from "@/features/explore/components/ExperienceFilterSection";
import { ExploreLayout } from "@/features/explore/components/ExploreLayout";
import type { ExploreViewMode } from "@/features/explore/components/ViewModeTabs";

function ShrinesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedName, setSubmittedName] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [viewMode, setViewMode] = useState<ExploreViewMode>("list");
  const showSubmissionPendingBanner = submitted;
  const shouldShowSearchResults = !showSubmissionPendingBanner;

  const [cards, setCards] = useState<ShrineCardAdapterProps[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null);
  const [goriyakuTags, setGoriyakuTags] = useState<GoriyakuTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const trackedEmptyStateKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    setQ((params.get("q") ?? "").trim());
    setSubmitted(isSubmissionPendingParams(params));
    setSubmittedName((params.get("name") ?? "").trim());
  }, [searchParams]);

  useEffect(() => {
    setInputValue(q);
  }, [q]);

  useEffect(() => {
    let alive = true;

    setTagsLoading(true);
    setTagsError(null);

    getGoriyakuTags()
      .then((tags) => {
        if (!alive) return;
        setGoriyakuTags(tags);
      })
      .catch(() => {
        if (!alive) return;
        setGoriyakuTags([]);
        setTagsError("ご利益タグを読み込めませんでした");
      })
      .finally(() => {
        if (!alive) return;
        setTagsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    if (typeof window !== "undefined" && q === "" && window.location.search.includes("q=")) {
      return () => {
        alive = false;
      };
    }

    if (!shouldShowSearchResults || q.length === 0) {
      setCards([]);
      setCount(0);
      setError(null);
      setLoadedQuery(q);
      setLoading(false);
      return () => {
        alive = false;
      };
    }

    setLoading(true);
    setError(null);
    setLoadedQuery(null);

    fetchShrines({ q })
      .then((data) => {
        if (!alive) return;
        const nextCards = data.results.map((shrine) => buildShrineListCardModel(shrine));
        setCards(nextCards);
        setCount(data.count);
        setLoadedQuery(q);
      })
      .catch(() => {
        if (!alive) return;
        setCards([]);
        setCount(0);
        setLoadedQuery(q);
        setError("神社データの取得に失敗しました");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [q, shouldShowSearchResults]);

  const hasSearched = q.length > 0;
  const isEmpty = shouldShowSearchResults && !loading && !error && hasSearched && loadedQuery === q && count === 0;

  useEffect(() => {
    if (!isEmpty) return;

    const emptyStateKey = q || "__empty__";
    if (trackedEmptyStateKeyRef.current === emptyStateKey) return;

    trackedEmptyStateKeyRef.current = emptyStateKey;
    trackSearchEvent("empty_state_view", {
      source: "shrines",
      query: q,
    });
  }, [isEmpty, q]);

  const submissionNoticeTitle = submittedName ? `「${submittedName}」の投稿を受け付けました` : "投稿を受け付けました";
  const activeGoriyakuTag = goriyakuTags.find((tag) => tag.name === q) ?? null;
  const activeVisitStyleTag = VISIT_STYLE_TAGS.find((tag) => tag === q) ?? null;
  const activeHistoryThemeTag = HISTORY_THEME_TAGS.find((tag) => tag === q) ?? null;
  const submissionNoticeBody = showSubmissionPendingBanner
    ? "現在公開準備中です。確認が完了するまで公開検索には表示されません。"
    : null;

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nextQ = inputValue.trim();
    const next = new URLSearchParams();

    setSubmitted(false);
    setSubmittedName("");
    setQ(nextQ);

    if (nextQ) {
      next.set("q", nextQ);
    }

    router.push(`/shrines${next.toString() ? `?${next.toString()}` : ""}`);
  };

  const handleTagSearch = (tagName: string) => {
    const nextQ = tagName.trim();
    if (!nextQ) return;

    setSubmitted(false);
    setSubmittedName("");

    if (q === nextQ) {
      setQ("");
      setInputValue("");
      router.push("/shrines");
      return;
    }

    setQ(nextQ);
    setInputValue(nextQ);

    router.push(`/shrines?q=${encodeURIComponent(nextQ)}`);
  };

  const handleAddShrine = () => {
    const returnTo = `/shrines${q ? `?q=${encodeURIComponent(q)}` : ""}`;
    trackSearchEvent("add_shrine_click", {
      source: "shrines",
      query: q,
      returnTo,
    });
    router.push(`/shrines/new?returnTo=${encodeURIComponent(returnTo)}`);
  };

  const handleReturnToSearch = () => {
    setSubmitted(false);
    setSubmittedName("");
    setQ("");
    setInputValue("");
    router.push("/shrines");
  };

  return (
    <main className="px-4 py-6">
      {shouldShowSearchResults ? (
        <div className="mb-8">
          <ExploreLayout
            activeTag={q}
            inputValue={inputValue}
            onInputValueChange={setInputValue}
            onSearchSubmit={handleSearch}
            goriyakuTags={goriyakuTags}
            tagsLoading={tagsLoading}
            tagsError={tagsError}
            activeGoriyakuTag={activeGoriyakuTag}
            onSelectTag={handleTagSearch}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            experienceFeedback={
              activeVisitStyleTag || activeHistoryThemeTag ? (
                <p className="text-xs text-emerald-700 opacity-70">
                  {activeVisitStyleTag ?? activeHistoryThemeTag}で表示中です。もう一度押すと解除できます。
                </p>
              ) : null
            }
          >
            {error && <p className="text-red-500">{error}</p>}

            {loading ? <p className="mb-5 text-sm text-stone-500">探しています...</p> : null}

            {hasSearched &&
              (isEmpty ? (
                <div className="rounded-3xl border border-stone-200/30 bg-stone-50/50 p-5">
                  <p className="text-sm text-stone-700 opacity-85">
                    {activeGoriyakuTag
                      ? `${activeGoriyakuTag.name}に合う神社はまだ登録されていません。`
                      : "お探しの神社が見つかりませんか？"}
                  </p>
                  <div className="mt-3">
                    <button
                      type="button"
                      className="rounded-full border border-emerald-200/50 bg-emerald-50/40 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100/30"
                      onClick={handleAddShrine}
                    >
                      神社を追加する
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <ul className="grid gap-4">
                    {cards.map((p) => (
                      <li key={p.shrineId}>
                        <ShrineCard
                          name={p.title}
                          shrineId={p.shrineId}
                          address={p.address ?? undefined}
                          recommendReason={p.description ?? undefined}
                          imageUrl={p.imageUrl ?? undefined}
                          tags={p.badges ?? []}
                          isNew={p.isNew}
                          href={`/shrines/${p.shrineId}`}
                        />
                      </li>
                    ))}
                  </ul>

                  <section className="mt-8 rounded-3xl border border-stone-200/25 bg-stone-50/25 p-5">
                    <p className="text-sm font-medium text-stone-800">迷いが残るときは</p>
                    <p className="mt-1.5 text-sm leading-6 text-stone-700 opacity-65">
                      気持ちから静かに整える導線があります。
                    </p>
                    <Link
                      href="/concierge"
                      className="mt-3 inline-flex rounded-full border border-emerald-200/50 bg-emerald-50/40 px-3 py-2 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100/30"
                    >
                      言葉を整える
                    </Link>
                  </section>
                </>
              ))}
          </ExploreLayout>
        </div>
      ) : null}

      {submissionNoticeBody && (
        <div className="mb-8 rounded-3xl border border-emerald-200/40 bg-emerald-50/50 p-4 text-sm text-emerald-700">
          <div className="mb-3 space-y-1.5">
            <p className="text-base font-semibold text-emerald-900">{submissionNoticeTitle}</p>
            <p className="leading-relaxed text-emerald-700 opacity-90">{submissionNoticeBody}</p>
            <p className="text-xs leading-relaxed text-emerald-700 opacity-70">
              ご利益タグなどの内容は確認時の参考情報として扱います。
            </p>
          </div>
          <button
            type="button"
            onClick={handleReturnToSearch}
            className="rounded-full border border-emerald-200/50 bg-emerald-50/40 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100/40"
          >
            神社を探すへ戻る
          </button>
        </div>
      )}

    </main>
  );
}

export default function ShrinesPage() {
  return (
    <Suspense fallback={<p className="p-4">読み込み中...</p>}>
      <ShrinesPageContent />
    </Suspense>
  );
}
