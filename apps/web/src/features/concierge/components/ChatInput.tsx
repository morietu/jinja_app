// apps/web/src/features/concierge/components/ChatInput.tsx
"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";

type Props = {
  disabled: boolean;
  onSend: (text: string) => Promise<unknown> | void;
  error?: string | null;
  embedMode?: boolean; // ✅ 追加
};

export default function ChatInput({ disabled, onSend, error = null, embedMode = false }: Props) {
  const [value, setValue] = useState("");
  const [flash, setFlash] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  
  useEffect(() => {
    const handler = () => {
      if (disabled) return;
      requestAnimationFrame(() => {
        textareaRef.current?.focus({ preventScroll: true } as any);
      });
    };

    window.addEventListener("concierge:focus-input", handler as EventListener);
    return () => window.removeEventListener("concierge:focus-input", handler as EventListener);
  }, [disabled]);

  // error の瞬間だけ flash + focus
  useEffect(() => {
    if (!error) return;

    setFlash(true);

    if (!disabled) {
      requestAnimationFrame(() => {
        textareaRef.current?.focus({ preventScroll: true } as any);
      });
    }

    const t = window.setTimeout(() => setFlash(false), 500);
    return () => window.clearTimeout(t);
  }, [error, disabled]);

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;

    await onSend(trimmed);
    setValue("");

    // 送信後も居続ける
    requestAnimationFrame(() => {
      textareaRef.current?.focus({ preventScroll: true } as any);
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return;

    if (isComposing) return; // IME中は送らない
    if (e.shiftKey) return; // Shift+Enter は改行

    e.preventDefault(); // Enter単体で送信
    void submit();
  };

  const placeholder = embedMode
    ? "条件を追加（例：静か／縁結び／駅近／ひとりで行きたい など）"
    : "条件を追加（例：静か／人混み少なめ／階段少なめ／縁結び など）";

  const buttonLabel = embedMode ? "更新" : "追加";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex items-end gap-2"
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        placeholder={placeholder}
        rows={2}
        disabled={disabled}
        className={[
          "flex-1 resize-none border-0 bg-transparent text-sm leading-relaxed outline-none placeholder:text-gray-400 pt-3",
          flash ? "ring-2 ring-rose-400/70 rounded-md" : "",
        ].join(" ")}
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {buttonLabel}
      </button>
    </form>
  );
}
