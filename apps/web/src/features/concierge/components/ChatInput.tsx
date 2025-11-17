import { useState } from "react";

type Props = {
  disabled?: boolean;
  onSend: (text: string) => Promise<void> | void;
};

export default function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || disabled || busy) return;

    try {
      setBusy(true);
      await onSend(value);
      setText("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        className="flex-1 rounded border p-2 text-sm"
        placeholder="神社の相談内容を入力してください…"
        disabled={disabled || busy}
      />
      <button
        type="submit"
        disabled={disabled || busy || !text.trim()}
        className="h-[40px] self-end rounded bg-blue-600 px-3 text-sm text-white disabled:opacity-60"
      >
        送信
      </button>
    </form>
  );
}
