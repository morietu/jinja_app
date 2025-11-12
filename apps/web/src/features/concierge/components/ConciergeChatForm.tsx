// src/features/concierge/components/ConciergeChatForm.tsx
"use client";

import { FormEvent, useState } from "react";
import { useConciergeChat } from "../hooks/useConciergeChat";
import type { ConciergeChatRequest } from "../types";
// 既存の UI ライブラリに合わせて import
// 例: import { Button } from "@/components/ui/button";
//     import { Input } from "@/components/ui/input";
//     import { useToast } from "@/components/ui/use-toast";

export function ConciergeChatForm() {
  const [message, setMessage] = useState("");
  const { loading, error, response, send } = useConciergeChat();
  // const { toast } = useToast();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    const payload: ConciergeChatRequest = {
      message: message.trim(),
      // TODO: 実際の現在地を入れるように後で差し替え
      lat: 35.71,
      lng: 139.8,
    };

    await send(payload);

    // if (error) {
    //   toast({
    //     variant: "destructive",
    //     description: error,
    //   });
    // }

    // 成功時も UI の仕様に合わせてトーストするならここで
  }

  const replyText = response?.reply ?? response?.data?.messages?.find((m) => m.role === "assistant")?.content ?? "";

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          className="flex-1 border rounded px-2 py-1"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="神社の相談を入力してください…"
          disabled={loading}
        />
        <button type="submit" disabled={loading || !message.trim()} className="px-3 py-1 border rounded">
          {loading ? "送信中…" : "送信"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {replyText && !error && (
        <div className="rounded border p-3 text-sm bg-white">
          <div className="font-semibold mb-1">コンシェルジュからの回答</div>
          <p>{replyText}</p>
        </div>
      )}
    </div>
  );
}
