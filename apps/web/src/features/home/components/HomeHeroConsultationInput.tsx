"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp } from "lucide-react";

function buildConciergeHref(theme: string, options?: { openFilter?: boolean }): string {
  const params = new URLSearchParams();
  const trimmed = theme.trim();

  if (trimmed) params.set("theme", trimmed);
  if (options?.openFilter) params.set("openFilter", "1");

  const qs = params.toString();
  return qs ? `/concierge?${qs}` : "/concierge";
}

const CONSULTATION_THEME_CHIPS = [
  {
    label: "疲れを整えたい",
    text: "最近少し疲れていて、気持ちを落ち着ける参拝がしたいです",
  },
  {
    label: "迷いを整理したい",
    text: "今の迷いを整理して、落ち着いて考えられる場所に行きたいです",
  },
  {
    label: "前に進みたい",
    text: "気持ちを切り替えて、前に進むきっかけがほしいです",
  },
  {
    label: "静かに考えたい",
    text: "静かな場所で、これからのことをゆっくり考えたいです",
  },
  {
    label: "人との縁を見直したい",
    text: "人とのご縁を見つめ直して、大切にできる参拝がしたいです",
  },
  {
    label: "仕事の流れを整えたい",
    text: "仕事の流れを整えて、次に進むきっかけがほしいです",
  },
] as const;

export function HomeHeroConsultationInput() {
  const router = useRouter();
  const [theme, setTheme] = useState("");
  const [isConditionHintOpen, setIsConditionHintOpen] = useState(false);

  const canSubmit = useMemo(() => theme.trim().length > 0, [theme]);

  const submitTheme = (value: string) => {
    const href = buildConciergeHref(value, { openFilter: isConditionHintOpen });
    router.push(href);
  };

  return (
    // Home構成の主コンテンツ。入力カード → chips → 条件リンクの順で縦に積み、
    // 「相談カードが主、それ以外は補助」という階層を並び順そのもので表す。
    <div className="w-full space-y-6 text-left">
      {/*
        相談入力カード: この画面唯一の焦点。
        面はマットのまま (Glassmorphismにしない = 背景の波線を透かさない)。
        「光が当たる部分だけ」を上辺のhairline highlightと、下へ落ちる
        極薄のwarm glowで表す。どちらもbrass Tokenのcolor-mixで、
        新しい色は作らない。これで入力エリアが、周囲のマットな補助カード
        (HomeActionCard) より一段手前にある主アクション面として読める。
      */}
      <div
        className="rounded-[1.75rem] border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] p-4"
        style={{
          boxShadow: [
            "inset 0 1px 0 color-mix(in oklab, var(--home-path, var(--kt-color-action-primary)) 20%, transparent)",
            "0 20px 44px -30px color-mix(in oklab, var(--home-path, var(--kt-color-action-primary)) 34%, transparent)",
          ].join(", "),
        }}
      >
        <label htmlFor="home-hero-consultation" className="block text-[11px] font-medium text-[var(--kt-color-text-muted)]">
          今の気持ちを少しだけ書く
        </label>

        <textarea
          id="home-hero-consultation"
          value={theme}
          onChange={(event) => setTheme(event.target.value)}
          placeholder="例: 気持ちを切り替えたい、これからのことを考えたい"
          rows={3}
          className="mt-2 w-full resize-none border-0 bg-transparent px-0 py-1 text-[15px] leading-8 text-[var(--kt-color-text-primary)] outline-none placeholder:text-[var(--kt-color-text-secondary)]"
        />

        <div className="mt-2 flex items-end justify-between gap-4">
          <p className="text-[11px] leading-5 text-[var(--kt-color-text-secondary)]">
            あなたの言葉から、ご縁のある神社へ
          </p>

          {/* 主CTA。円形の金は画面内で一箇所のみに置き、
              有効時だけ微光(--kt-shadow-brand)を纏わせる。 */}
          <button
            type="button"
            aria-label="この相談ではじめる"
            title="この相談ではじめる"
            className={[
              "inline-flex size-12 shrink-0 items-center justify-center rounded-full transition",
              canSubmit
                ? "bg-[var(--kt-color-action-primary)] text-[var(--kt-color-action-primary-text)] shadow-[var(--kt-shadow-brand)] hover:bg-[var(--kt-color-action-primary-hover)] active:scale-[0.97]"
                : // 無効時も金を保つ。中立色にすると焦点そのものが消えるため、減光で表す。
                  "cursor-not-allowed border border-[var(--kt-color-action-primary)] bg-transparent text-[var(--kt-color-action-primary)] opacity-40",
            ].join(" ")}
            disabled={!canSubmit}
            onClick={() => submitTheme(theme)}
          >
            <ArrowUp className="size-5" aria-hidden />
          </button>
        </div>
      </div>

      {/* 候補チップ: 入力カードの外に出し、補助であることを位置で示す。 */}
      <div>
        <p className="px-1 text-[11px] font-medium text-[var(--kt-color-text-muted)]">
          ことばが浮かばないときは、ここから
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CONSULTATION_THEME_CHIPS.map((chip) => {
            const isSelected = theme.trim() === chip.text;
            return (
              <button
                key={chip.label}
                type="button"
                className={[
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-[0.98]",
                  isSelected
                    ? "border-[var(--kt-color-action-primary)] bg-[var(--kt-color-surface-elevated)] text-[var(--kt-color-action-primary)]"
                    : "border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] text-[var(--kt-color-text-secondary)] hover:border-[var(--kt-color-border-strong)]",
                ].join(" ")}
                onClick={() => setTheme(chip.text)}
                aria-pressed={isSelected}
                title={chip.text}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-1">
        <button
          type="button"
          className="inline-flex items-center text-xs font-medium text-[var(--kt-color-text-secondary)] transition hover:text-[var(--kt-color-action-primary)]"
          onClick={() => setIsConditionHintOpen((current) => !current)}
          aria-expanded={isConditionHintOpen}
        >
          ＋ 条件を追加する
        </button>
        {isConditionHintOpen ? (
          <p className="mt-2 rounded-2xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] px-3 py-2 text-xs leading-6 text-[var(--kt-color-text-muted)]">
            誕生日やご利益、参拝スタイルなどの条件は次のステップで追加できます。
          </p>
        ) : null}
      </div>
    </div>
  );
}

export { buildConciergeHref };
