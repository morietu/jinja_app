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

const QUICK_PRESETS: readonly { label: string; value: string }[] = [
  { label: "静かに整えたい", value: "静かな雰囲気で、気持ちを落ち着けて整理できる場所がいい" },
  { label: "背中を押してほしい", value: "前向きになれる、活力が出る感じの場所がいい" },
  { label: "人混みが苦手", value: "混雑しにくい、落ち着いた場所がいい" },
  { label: "階段少なめ", value: "階段や坂が少なく、歩きやすいところがいい" },
  { label: "近場優先", value: "できるだけ近い場所を優先して" },
];

function mergeExtra(prev: string, add: string) {
  const p = (prev || "").trim();
  const a = (add || "").trim();
  if (!a) return p;
  if (!p) return a;
  // 既に含まれてたら重ねない（雑に効く）
  if (p.includes(a)) return p;
  return `${p}\n${a}`;
}

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
          ) : null}

          {/* ✅ 誕生日なしでも押せる入口（気分プリセット） */}
          <div className="space-y-1">
              <div className="text-[11px] font-semibold text-slate-600">気分チップ（誕生日なしでもOK）</div>
              <div className="text-[11px] text-slate-500">タップで「補足条件」に追加されます</div>
            <div className="flex flex-wrap gap-2">
              {QUICK_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="rounded-full border bg-white px-3 py-1 text-xs font-semibold hover:bg-slate-50"
                  onClick={() => onExtraConditionChange(mergeExtra(extraCondition, p.value))}
                  title={p.value}
                >
                  {p.label}
                </button>
              ))}

              {/* 便利ボタン：一発で空にする */}
              {extraCondition.trim() ? (
                <button
                  type="button"
                  className="rounded-full border bg-white px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                  onClick={() => onExtraConditionChange("")}
                >
                  クリア
                </button>
              ) : null}
            </div>
          </div>

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
