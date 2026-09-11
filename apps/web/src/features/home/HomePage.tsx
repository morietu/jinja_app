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
import { HomeBackdrop } from "@/features/home/components/HomeBackdrop";

export default function HomePage() {
  return (
    // 地色はHome限定のArt Direction Layer (--home-ground = Deep Ink Navy)。
    // Global の --kt-color-background-base は変更していないため、
    // fallbackとして残し、:has()非対応環境では従来のDark Forest地で描画する。
    <div
      data-app-frame="home"
      className="relative isolate min-h-full bg-[var(--home-ground,var(--kt-color-background-base))]"
    >
      {/*
        背景モチーフ (Deep Ink Navyの地 / 大気 / 波線3本 / Main Orb)。
        旧実装の「木漏れ日」1枚をここへ引き継ぎ、Luminous Pathとして再構成した。
        画像は使わず、CSS gradientとinline SVGのみ。装飾のためaria-hidden。
      */}
      <HomeBackdrop />

      <HomeToastClient />

      <div className="mx-auto w-full max-w-[27rem] px-5 pb-24 pt-9">
        <Suspense fallback={<div className="text-sm text-[var(--kt-color-text-muted)]">読み込み中…</div>}>
          <HomeMainClient />
        </Suspense>
      </div>
    </div>
  );
}
