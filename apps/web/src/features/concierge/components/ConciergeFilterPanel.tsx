"use client";

import { useState } from "react";

import type { GoriyakuTag, Element4 } from "@/features/concierge/sections/types";

type Props = {
  isOpen: boolean;
  title?: string;

  onClose: () => void;
  onApply: () => void;

  birthdate: string;
  onBirthdateChange: (v: string) => void;

  element4: Element4 | null;

  goriyakuTags: readonly GoriyakuTag[];
  suggestedTags: readonly GoriyakuTag[];
  selectedTagIds: readonly number[];
  onToggleTag: (tagId: number) => void;

  tagsLoading: boolean;
  tagsError: string | null;

  extraCondition: string;
  onExtraConditionChange: (v: string) => void;

  // Level 2 Visit Preference (Structured, canonical tags). Sent alongside
  // extraCondition (Legacy/Transitional, free-text) -- see
  // docs/product/concierge-input-architecture.md Addendum: Level 2 Visit
  // Preference Signal Redesign.
  visitPreferences?: readonly string[];
  onVisitPreferencesChange?: (tags: string[]) => void;

  canApply?: boolean;
};

const QUICK_PRESET_GROUPS: readonly {
  title: string;
  description: string;
  items: readonly { label: string; value: string }[];
}[] = [
  {
    title: "体験スタイル",
    description: "どう過ごしたいかを、候補の並び方の参考にします。",
    items: [
      { label: "静かな時間を過ごしたい", value: "静かな雰囲気で、気持ちを落ち着けて整理できる場所がいい" },
      { label: "気分を切り替えたい", value: "気持ちを切り替えて、前向きになれる場所がいい" },
      { label: "自然を感じたい", value: "自然を感じながら、ゆっくり参拝できる場所がいい" },
      { label: "歴史や文化に触れたい", value: "歴史や文化を感じながら、意味を受け取れる場所がいい" },
    ],
  },
  {
    title: "実用条件",
    description: "無理なく行けるか、安心して過ごせるかの補助条件です。",
    items: [
      { label: "近場がいい", value: "できるだけ近い場所を優先して" },
      { label: "アクセスしやすい場所がいい", value: "駅から行きやすく、移動の負担が少ない場所がいい" },
      { label: "有名な神社が安心", value: "有名で定番感があり、安心して参拝しやすい場所がいい" },
      { label: "人混みを避けたい", value: "混雑しにくい、落ち着いた場所がいい" },
    ],
  },
  {
    title: "神社好き向け",
    description: "神社そのものの楽しみ方を、補助条件として加えます。",
    items: [
      { label: "由緒を知りたい", value: "由緒や背景を感じながら参拝できる場所がいい" },
      { label: "御朱印を楽しみたい", value: "御朱印も楽しみながら参拝できる場所がいい" },
      { label: "神話に触れたい", value: "神話や祀られている神様の文脈に触れられる場所がいい" },
      { label: "境内をゆっくり歩きたい", value: "境内をゆっくり歩きながら、落ち着いて過ごせる場所がいい" },
    ],
  },
];

const INITIAL_VISIBLE_GORIYAKU_COUNT = 4;

// UI label -> Level 2 canonical Visit Preference tag(s) (Structured Signal
// Mapping). Sent directly, no keyword parsing -- see
// docs/product/concierge-input-architecture.md Addendum: Level 2 Visit
// Preference Signal Redesign and docs/product/visit-style-taxonomy.md.
//
// Canonical vocabulary: quiet / nature / reset / less_crowded / nearby / classic
// (backend/temples/domain/visit_preference.py).
//
// "御朱印を楽しみたい" has no entry -- per visit-style-taxonomy.md it stays
// natural-language-only (no Shrine-side capability to evaluate it, Task 13
// Shrine Data Capability Check: Hold).
const PRESET_VISIT_PREFERENCE_TAGS: Readonly<Record<string, readonly string[]>> = {
  静かな時間を過ごしたい: ["quiet"],
  気分を切り替えたい: ["reset"],
  自然を感じたい: ["nature"],
  歴史や文化に触れたい: ["classic"],
  近場がいい: ["nearby"],
  アクセスしやすい場所がいい: ["nearby"],
  有名な神社が安心: ["classic"],
  人混みを避けたい: ["less_crowded"],
  由緒を知りたい: ["classic"],
  神話に触れたい: ["classic"],
  境内をゆっくり歩きたい: ["quiet", "nature"],
};

function mergeExtra(prev: string, add: string) {
  const p = (prev || "").trim();
  const a = (add || "").trim();
  if (!a) return p;
  if (!p) return a;
  if (p.includes(a)) return p;
  return `${p}\n${a}`;
}

function mergeVisitPreferences(prev: readonly string[], add: readonly string[]): string[] {
  const next = new Set(prev);
  for (const tag of add) next.add(tag);
  return Array.from(next);
}

export default function ConciergeFilterPanel({
  isOpen,
  title = "希望を補足する",
  onClose,
  onApply,
  birthdate,
  onBirthdateChange,
  element4,
  goriyakuTags,
  suggestedTags,
  selectedTagIds,
  onToggleTag,
  tagsLoading,
  tagsError,
  extraCondition,
  onExtraConditionChange,
  visitPreferences = [],
  onVisitPreferencesChange,
  canApply = false,
}: Props) {
  const [showAllGoriyakuTags, setShowAllGoriyakuTags] = useState(false);

  if (!isOpen) return null;

  const selected = new Set(selectedTagIds);
  const visibleGoriyakuTags = showAllGoriyakuTags
    ? goriyakuTags
    : goriyakuTags.slice(0, INITIAL_VISIBLE_GORIYAKU_COUNT);
  const hiddenGoriyakuCount = Math.max(goriyakuTags.length - INITIAL_VISIBLE_GORIYAKU_COUNT, 0);

  return (
    <section className="mx-auto w-full max-w-md min-w-0 space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2 sm:max-h-none">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-700">{title}</div>
        <button type="button" className="text-[11px] font-semibold text-slate-600 hover:underline" onClick={onClose}>
          閉じる
        </button>
      </div>

      <div className="grid gap-0.5 rounded-xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] p-2">
        {/* Level 3-A Personal Profile */}
        <section aria-label="誕生日（任意）" className="space-y-0.5">
          <div className="text-[10px] font-semibold text-[var(--kt-color-text-muted)]">誕生日（任意）</div>
          <div className="text-[10px] text-slate-400">相性候補を見るための任意の補助情報です</div>
          <input
            type="date"
            value={birthdate}
            onChange={(e) => onBirthdateChange(e.target.value)}
            className="w-full rounded-xl border px-3 py-1.5 text-sm"
          />
        </section>

        {element4 ? (
          <div className="text-[11px] text-[var(--kt-color-text-muted)]">
            誕生日から見た補助傾向:{" "}
            <span className="font-semibold text-[var(--kt-color-text-secondary)]">{element4}</span>
          </div>
        ) : null}

        {/* Level 2 Visit Preference */}
        <section aria-label="今回の参拝の希望（任意）" className="space-y-1.5">
          <div>
            <div className="text-[10px] font-semibold text-slate-600">参拝スタイル</div>
            <p className="mt-0.5 text-[10px] leading-4 text-slate-400">
              相談テーマを主軸にしたまま、過ごし方や行きやすさを補助条件として加えます。
            </p>
          </div>

          {QUICK_PRESET_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1 rounded-lg border border-slate-100 bg-slate-50/60 p-1.5">
              <div>
                <div className="text-[10px] font-semibold text-slate-600">{group.title}</div>
                <p className="mt-0.5 text-[10px] leading-4 text-slate-400">{group.description}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {group.items.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className="rounded-full border bg-[var(--kt-color-surface-default)] px-2.5 py-1 text-xs font-semibold hover:bg-slate-50"
                    onClick={() => {
                      onExtraConditionChange(mergeExtra(extraCondition, p.value));
                      const tags = PRESET_VISIT_PREFERENCE_TAGS[p.label];
                      if (tags?.length) {
                        onVisitPreferencesChange?.(mergeVisitPreferences(visitPreferences, tags));
                      }
                    }}
                    title={p.value}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>

        {element4 && suggestedTags.length > 0 ? (
          <div className="space-y-0.5">
            <div className="text-[10px] font-semibold text-[var(--kt-color-text-muted)]">相性から見た候補</div>
            <p className="text-[10px] leading-4 text-slate-400">
              誕生日情報をもとにした補助候補です。相談テーマとの一致を優先します。
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestedTags.map((t) => {
                const on = selected.has(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      on
                        ? "border-[var(--kt-color-action-primary)] bg-[var(--kt-color-background-subtle)] text-[var(--kt-color-action-primary)]"
                        : "border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] text-[var(--kt-color-text-secondary)]"
                    }`}
                    onClick={() => onToggleTag(t.id)}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {/* Level 3-B Explicit Constraint -- a DB-level candidate hard filter,
          not a "おすすめテーマ"/Personal Profile. Kept distinct from L2
          (参拝スタイル) and L3-A (誕生日) above (Task 7). */}
      {tagsLoading || tagsError || visibleGoriyakuTags.length > 0 || hiddenGoriyakuCount > 0 ? (
        <section
          aria-label="ご利益を指定する"
          className="space-y-1 rounded-xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] p-2"
        >
          <div>
            <div className="text-[10px] font-semibold text-[var(--kt-color-text-secondary)]">ご利益を指定する</div>
            <p className="mt-0.5 text-[10px] leading-4 text-[var(--kt-color-text-muted)]">
              相談テーマを主軸にしつつ、願いたいことに近いものを候補の絞り込みとして使います。
            </p>
          </div>
          {tagsError ? <div className="text-xs text-[var(--kt-color-status-error)]">{tagsError}</div> : null}
          {tagsLoading ? <div className="text-xs text-[var(--kt-color-text-muted)]">読み込み中…</div> : null}

          {visibleGoriyakuTags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {visibleGoriyakuTags.map((t) => {
                const on = selected.has(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      on
                        ? "border-[var(--kt-color-action-primary)] bg-[var(--kt-color-background-subtle)] text-[var(--kt-color-action-primary)]"
                        : "border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] text-[var(--kt-color-text-secondary)]"
                    }`}
                    onClick={() => onToggleTag(t.id)}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          ) : null}

          {hiddenGoriyakuCount > 0 ? (
            <button
              type="button"
              className="text-left text-[11px] font-semibold text-[var(--kt-color-text-muted)] hover:text-slate-700 hover:underline"
              onClick={() => setShowAllGoriyakuTags((prev) => !prev)}
            >
              {showAllGoriyakuTags ? "折りたたむ" : `他${hiddenGoriyakuCount}件を表示`}
            </button>
          ) : null}
        </section>
      ) : null}

      <div className="flex justify-end gap-2 border-t border-[var(--kt-color-border-default)] bg-slate-50/95 pt-1.5 pb-0.5">
        <button type="button" className="rounded-xl border px-3 py-1.5 text-sm font-semibold" onClick={onClose}>
          キャンセル
        </button>

        <button
          type="button"
          onClick={() => {
            onApply();
          }}
          disabled={!canApply}
          className={[
            "relative z-20 rounded-xl px-3 py-1.5 text-sm font-semibold transition",
            canApply
              ? "bg-[var(--kt-color-action-primary)] text-[var(--kt-color-action-primary-text)] hover:bg-[var(--kt-color-action-primary-hover)]"
              : "bg-slate-200 text-slate-400 cursor-not-allowed",
          ].join(" ")}
        >
          この内容に反映する
        </button>
      </div>
    </section>
  );
}
