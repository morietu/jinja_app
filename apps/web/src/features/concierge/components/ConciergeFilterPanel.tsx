// apps/web/src/features/concierge/components/ConciergeFilterPanel.tsx
"use client";

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
};

export default function ConciergeFilterPanel({
  isOpen,
  title = "条件を追加して絞る",
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
}: Props) {
  console.log("[FilterPanel.isOpen]", isOpen);
  
  if (!isOpen) return null;

  const selected = new Set(selectedTagIds);

  return (
    <section className="mx-auto w-full max-w-md min-w-0 space-y-3 rounded-xl border bg-white p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-700">{title}</div>
        <button type="button" className="text-[11px] font-semibold text-slate-600 hover:underline" onClick={onClose}>
          閉じる
        </button>
      </div>

      {/* 相性のヒント */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-700">相性のヒント（任意）</div>

        <div className="grid gap-2">
          <input
            type="date"
            value={birthdate}
            onChange={(e) => onBirthdateChange(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 text-sm"
          />

          {element4 ? (
            <div className="text-xs text-slate-600">
              あなたの傾向：<span className="font-semibold">{element4}</span>（参考）
            </div>
          ) : (
            <div className="text-[11px] text-slate-500">入力するとおすすめ条件を提案します</div>
          )}

          {element4 && suggestedTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {suggestedTags.map((t) => {
                const on = selected.has(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      on ? "border-emerald-600 bg-emerald-50" : "bg-white"
                    }`}
                    onClick={() => onToggleTag(t.id)}
                  >
                    おすすめ {t.name}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {/* ご利益 */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-700">ご利益</div>
        {tagsError ? <div className="text-xs text-red-600">{tagsError}</div> : null}
        {tagsLoading ? <div className="text-xs text-slate-500">読み込み中…</div> : null}

        <div className="flex flex-wrap gap-2">
          {goriyakuTags.map((t) => {
            const on = selected.has(t.id);
            return (
              <button
                key={t.id}
                type="button"
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  on ? "border-emerald-600 bg-emerald-50" : "bg-white"
                }`}
                onClick={() => onToggleTag(t.id)}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* 補足条件 */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-700">補足条件</div>
        <textarea
          value={extraCondition}
          onChange={(e) => onExtraConditionChange(e.target.value)}
          placeholder="例：静かな雰囲気、階段が少ない、など"
          className="w-full rounded-xl border p-3 text-sm"
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className="rounded-xl border px-4 py-2 text-sm font-semibold" onClick={onClose}>
          キャンセル
        </button>

        <button
          type="button"
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
          onClick={onApply}
        >
          この条件で絞る
        </button>
      </div>
    </section>
  );
}
