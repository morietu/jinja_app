// apps/web/src/features/concierge/components/ChatInput.tsx
import { useState } from "react";

type Props = {
  disabled: boolean;
  onSend: (text: string) => Promise<unknown> | void;
};

export default function ChatInput({ disabled, onSend }: Props) {
  const [value, setValue] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || disabled) return;
    await onSend(value.trim());
    setValue("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="神社の相談内容を入力してください（例：仕事・恋愛・健康・お礼参りなど）"
        rows={2}
        className="
          flex-1 resize-none border-0 bg-transparent text-sm leading-relaxed
          outline-none placeholder:text-gray-400
          pt-3          /* ← ここで下にずらす（上に余白を追加） */
        "
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        送信
      </button>
    </form>
  );
}
