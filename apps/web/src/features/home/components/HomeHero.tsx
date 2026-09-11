"use client";

import { HomeHeroConsultationInput } from "./HomeHeroConsultationInput";

export function HomeHero() {
  return (
    // Home上部の単一の焦点。旧実装は大きな角丸カード(py-24)でHeroを囲っていたが、
    // カードの表現は入力カードへ集約し、Hero自体は面を持たない見出し帯とする。
    // これにより「カードが二重になって焦点が割れる」状態を避ける。
    <section className="space-y-7">
      <div className="space-y-3">
        <p className="text-[10px] font-medium tracking-[0.3em] text-[var(--kt-color-text-muted)]">KAMI MUSUBI</p>
        {/*
          Japanese Modern Classic の主役。日本語見出しだけを明朝Displayにする。
          Webfontは追加していない（--home-font-display はOS標準明朝への
          フォールバック指定のみ / bundle影響ゼロ）。明朝が無い環境では
          serif、それも無ければ既存の継承フォントに戻るだけで構図は崩れない。

          明朝は同じ字面でも線が細く見えるため、weightをsemibold(600)から
          medium(500)へ落とし、字間の詰め(tracking-tight)も外して
          本来の字送りに戻す。文言・改行位置は変更していない。
        */}
        <h1
          className="text-[27px] font-medium leading-[1.4] text-[var(--kt-color-text-primary)]"
          style={{ fontFamily: "var(--home-font-display)" }}
        >
          今の相談から、
          <br />
          向かう神社を見つける
        </h1>
        <p className="text-[13px] leading-7 text-[var(--kt-color-text-secondary)]">
          迷っていることを一言にすると、今の気持ちに合わせて神社との出会いを整えます。
        </p>
      </div>

      <HomeHeroConsultationInput />
    </section>
  );
}
