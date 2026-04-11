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

  canApply?: boolean;
};

const QUICK_PRESETS: readonly { label: string; value: string }[] = [
  { label: "静かに整えたい", value: "静かな雰囲気で、気持ちを落ち着けて整理できる場所がいい" },
  { label: "背中を押してほしい", value: "前向きになれる、活力が出る感じの場所がいい" },
  { label: "人混みが苦手", value: "混雑しにくい、落ち着いた場所がいい" },
  { label: "階段少なめ", value: "階段や坂が少なく、歩きやすいところがいい" },
  { label: "近場優先", value: "できるだけ近い場所を優先して" },
];

const INITIAL_VISIBLE_GORIYAKU_COUNT = 4;

function mergeExtra(prev: string, add: string) {
  const p = (prev || "").trim();
  const a = (add || "").trim();
  if (!a) return p;
  if (!p) return a;
  if (p.includes(a)) return p;
  return `${p}\n${a}`;
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
  canApply = false,
}: Props) {
  if (!isOpen) return null;


  const selected = new Set(selectedTagIds);
  const visibleGoriyakuTags = goriyakuTags.slice(0, INITIAL_VISIBLE_GORIYAKU_COUNT);
  const hiddenGoriyakuCount = Math.max(goriyakuTags.length - INITIAL_VISIBLE_GORIYAKU_COUNT, 0);

  return (
    <section
      className="mx-auto w-full max-w-md min-w-0 space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2 sm:max-h-none"
    >
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold text-slate-600">{title}</div>
        <button type="button" className="text-[11px] font-semibold text-slate-600 hover:underline" onClick={onClose}>
          閉じる
        </button>
      </div>

      <div className="grid gap-0.5 rounded-xl border border-slate-200 bg-white p-2">
        <div className="space-y-0.5">
          <div className="text-[10px] font-semibold text-slate-500">誕生日（任意）</div>
          <div className="text-[10px] text-slate-400">相性の参考にします</div>
          <input
            type="date"
            value={birthdate}
            onChange={(e) => onBirthdateChange(e.target.value)}
            className="w-full rounded-xl border px-3 py-1.5 text-sm"
          />
        </div>

        {element4 ? (
          <div className="text-[11px] text-slate-500">
            あなたの傾向: <span className="font-semibold text-slate-700">{element4}</span>
          </div>
        ) : null}

        <div className="space-y-0">
          <div className="text-[10px] font-semibold text-slate-500">今の気分に近いもの</div>
          <div className="flex flex-wrap gap-1.5">
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
          </div>
        </div>

        {element4 && suggestedTags.length > 0 ? (
          <div className="space-y-0.5">
            <div className="text-[10px] font-semibold text-slate-500">おすすめ</div>
            <div className="flex flex-wrap gap-1.5">
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
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {tagsLoading || tagsError || visibleGoriyakuTags.length > 0 || hiddenGoriyakuCount > 0 ? (
        <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-2">
          {tagsError ? <div className="text-xs text-red-600">{tagsError}</div> : null}
          {tagsLoading ? <div className="text-xs text-slate-500">読み込み中…</div> : null}

          {visibleGoriyakuTags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {visibleGoriyakuTags.map((t) => {
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
          ) : null}

          {hiddenGoriyakuCount > 0 ? <div className="text-[11px] text-slate-500">他{hiddenGoriyakuCount}件</div> : null}
        </div>
      ) : null}

      <div className="space-y-0.5 rounded-xl border border-slate-200 bg-white p-2">
        <textarea
          value={extraCondition}
          onChange={(e) => onExtraConditionChange(e.target.value)}
          placeholder="例：静かな雰囲気がいい、階段は少なめがいい、など"
          className="w-full rounded-xl border p-1.5 text-sm"
          rows={1}
        />
      </div>

      <div
        className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50/95 pt-1.5 pb-0.5"
      >
        <button type="button" className="rounded-xl border px-3 py-1.5 text-sm font-semibold" onClick={onClose}>
          キャンセル
        </button>

        <button
          type="button"
          onClick={onApply}
          disabled={false}
          style={{ pointerEvents: "auto" }}
          className={[
            "relative z-20 rounded-xl px-3 py-1.5 text-sm font-semibold transition",
            canApply
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "bg-slate-200 text-slate-400 cursor-not-allowed",
          ].join(" ")}
        >
          この内容に反映する
        </button>
      </div>
    </section>
  );
}
