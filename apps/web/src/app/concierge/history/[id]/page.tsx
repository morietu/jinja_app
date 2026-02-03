// apps/web/src/app/concierge/history/[id]/page.tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";

import { useConciergeThreadDetail } from "@/features/concierge/hooks";
import ConciergeLayout from "@/features/concierge/components/ConciergeLayout";

import type { ConciergeMessage, ConciergeThread, ConciergeRecommendation } from "@/lib/api/concierge";

import ConciergeSections from "@/features/concierge/components/ConciergeSections";
import { buildConciergeSections } from "@/features/concierge/sectionsBuilder";

import ConciergeSectionsRenderer from "@/features/concierge/components/ConciergeSectionsRenderer";
import { SHOW_NEW_RENDERER } from "@/features/concierge/rendererMode";
import { buildPayloadFromUnified } from "@/features/concierge/buildPayloadFromUnified";
import { buildDummySections } from "@/features/concierge/sections/dummy";
import type { UnifiedConciergeResponse } from "@/features/concierge/types/unified";
import type { RendererAction } from "@/features/concierge/sections/types";

export default function ConciergeHistoryDetailPage() {
  const params = useParams();
  const threadId = Array.isArray(params.id) ? params.id[0] : (params.id as string);

  const { detail, loading, error } = useConciergeThreadDetail(threadId);

  const thread = (detail?.thread ?? null) as ConciergeThread | null;

  const messages = useMemo(() => (detail?.messages ?? []) as ConciergeMessage[], [detail]);
  const recommendations = useMemo(() => (detail?.recommendations ?? []) as ConciergeRecommendation[], [detail]);

  const filterState = useMemo(
    () => ({
      isOpen: false,
      birthdate: "",
      element4: null,
      goriyakuTags: [],
      suggestedTags: [],
      selectedTagIds: [],
      tagsLoading: false,
      tagsError: null,
      extraCondition: "",
    }),
    [],
  );

  const unifiedForHistory = useMemo<UnifiedConciergeResponse | null>(() => {
    if (!thread) return null;
    return {
      ok: true,
      data: { recommendations } as any,
      reply: null,
      stop_reason: null,
      note: null,
      remaining_free: null,
      thread: thread as any,
    } as any;
  }, [thread, recommendations]);

  const payload = useMemo(() => {
    const built = unifiedForHistory ? buildPayloadFromUnified(unifiedForHistory, filterState) : null;
    return built ?? buildDummySections(filterState);
  }, [unifiedForHistory, filterState]);

  const sections = useMemo(() => buildConciergeSections(recommendations as any, []), [recommendations]);

  // return分岐
  if (loading) {
    return <main className="mx-auto max-w-md px-4 py-4 text-xs text-gray-500">相談履歴を読み込んでいます…</main>;
  }
  if (error) {
    return <main className="mx-auto max-w-md px-4 py-4 text-xs text-red-700">履歴の取得に失敗しました。</main>;
  }
  if (!detail || !thread) {
    return (
      <main className="mx-auto max-w-md px-4 py-4 text-xs text-gray-500">この相談履歴は見つかりませんでした。</main>
    );
  }

  // ✅ threadが確定してから作る
  const continueHref = `/concierge?tid=${thread.id}`;

  // callback用途（Linkにしにくいので割り切り）
  const go = (href: string) => window.location.assign(href);

  const onRendererAction = (a: RendererAction) => {
    switch (a.type) {
      case "open_map":
        go("/map");
        return;
      case "add_condition":
        go(continueHref);
        return;
      default:
        return;
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 py-4 space-y-3">
      <header className="flex items-center justify-between">
        <Link href="/concierge/history" className="text-xs text-gray-500 underline active:opacity-70">
          ← 履歴一覧へ戻る
        </Link>
        <h1 className="text-sm font-semibold text-gray-800">相談履歴</h1>
      </header>

      <p className="text-xs text-gray-500">過去の相談内容と、当時のおすすめ候補です。</p>

      <ConciergeLayout
        messages={messages}
        sending={false}
        error={null}
        onSend={() => {}}
        canSend={false}
        embedMode={false}
      >
        {SHOW_NEW_RENDERER ? (
          <div className="p-4 space-y-3">
            <ConciergeSectionsRenderer payload={payload} onAction={onRendererAction} sending={false} />
          </div>
        ) : (
          <ConciergeSections sections={sections} />
        )}
      </ConciergeLayout>

      <Link
        href={continueHref}
        className="mt-3 block w-full rounded-full bg-black py-3 text-center text-sm font-semibold text-white shadow-md active:scale-[0.98]"
      >
        この相談の続きでコンシェルジュに聞く
      </Link>
    </main>
  );
}
