// apps/web/src/features/home/HomePage.tsx
//
// Home (Server Component)
// - データ取得や状態管理はしない
// - Client を並べ、画面全体の構図(中央寄せの狭いカラム + 周囲の大気)だけを持つ
//
// 構図の方針:
// 旧実装は max-w-4xl の横広カラムに、幅の異なるブロックを縦に散在させていた
// (ml-2 / ml-auto / max-w-[34rem] / max-w-[30rem])。結果としてデスクトップでは
// 「余白に要素が散らばる広いWebページ」に見えていた。
// 本実装では Mobile 側 (apps/mobile: maxWidth 430 + outside の余白) と同じ構図を採り、
// 本文を電話幅の単一カラムへ集約する。デスクトップの余白は情報を置く場所ではなく、
// カラムを浮かび上がらせるための「大気」として扱う。
import { Suspense } from "react";
import { HomeToastClient } from "@/features/home/components/HomeToastClient";
import { HomeMainClient } from "@/features/home/components/HomeMainClient";

export default function HomePage() {
  return (
    <div
      data-app-frame="home"
      className="relative isolate min-h-full bg-[var(--kt-color-background-base)]"
    >
      {/*
        木漏れ日。上方から差す柔らかい光だけを表現し、テクスチャや装飾は置かない。
        値は既存Tokenの color-mix のみで構成し、新しい色は導入しない。
        1層目: 本文カラムを持ち上げる面の光
        2層目: shrine-gold のごく薄い暖かみ (6%)
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: [
            "radial-gradient(110% 52% at 50% -6%, color-mix(in oklab, var(--kt-color-surface-elevated) 90%, transparent) 0%, transparent 68%)",
            "radial-gradient(58% 26% at 50% 0%, color-mix(in oklab, var(--kt-color-action-primary) 6%, transparent) 0%, transparent 72%)",
          ].join(", "),
        }}
      />

      <HomeToastClient />

      <div className="mx-auto w-full max-w-[27rem] px-5 pb-24 pt-9">
        <Suspense fallback={<div className="text-sm text-[var(--kt-color-text-muted)]">読み込み中…</div>}>
          <HomeMainClient />
        </Suspense>
      </div>
    </div>
  );
}
