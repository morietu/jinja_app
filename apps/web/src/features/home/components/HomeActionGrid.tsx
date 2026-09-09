// apps/web/src/features/home/components/HomeActionGrid.tsx
//
// Home下部の補助導線。旧実装では Compass / 地図 / 神社一覧 が
// それぞれ横幅の異なる独立ブロックとして縦に散在し、デスクトップで
// 「広い面に要素が散らばる」印象の主因になっていた。本コンポーネントで
// 2カラムの等価なグリッドへ統合する。
//
// IA制約 (docs/audit/compass-home-entry-ia.md):
// Compassは Concierge の後続ではなく独立した入口である。旧実装は
// 「相談のあとに、場所でも確かめる」という見出しがConciergeを前提と
// するため、Compassをその配下に置くことを避けていた。本実装では
// 見出しを「ほかの入り口から」という中立な文言にすることでこの前提を
// 持たせず、Compassをグリッド先頭に置いて独立性を保つ。
//
// Compassのアナリティクス契約 (docs/audit/compass-analytics-contract-readiness.md §6)
// は据え置き: /compass?ref=home へのリンクと home_compass_entry_click の
// 送出を、旧 HomeCompassSection からそのまま引き継ぐ。
"use client";

import { Compass, Map, List, ScrollText } from "lucide-react";

import { trackSearchEvent } from "@/lib/analytics/searchEvents";
import { HomeActionCard } from "./HomeActionCard";

export function HomeActionGrid() {
  return (
    <section className="space-y-4">
      <div className="space-y-1.5 px-1">
        <p className="text-[9px] font-medium tracking-[0.24em] text-[var(--kt-color-text-muted)]">ANOTHER WAY IN</p>
        <h2 className="text-[15px] font-medium text-[var(--kt-color-text-primary)]">ほかの入り口から</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <HomeActionCard
          href="/compass?ref=home"
          icon={Compass}
          title="今月から探す"
          subtitle="今月の流れと方向から"
          onClick={() => trackSearchEvent("home_compass_entry_click", { source: "home" })}
        />
        <HomeActionCard href="/map" icon={Map} title="地図から探す" subtitle="近くの神社を巡る" />
        <HomeActionCard href="/shrines" icon={List} title="神社一覧" subtitle="ご利益から見る" />
        <HomeActionCard href="/goshuins" icon={ScrollText} title="参拝の記録" subtitle="結んだご縁を残す" />
      </div>
    </section>
  );
}
