// src/features/concierge/components/ConciergeChatForm.tsx
"use client";

import { FormEvent, useState } from "react";
import { useConciergeChat } from "../hooks/useConciergeChat";
import type { ConciergeChatRequest } from "../types";
import { useConciergePlan } from "../hooks/useConciergePlan";
// 既存の UI ライブラリに合わせて import
// 例: import { Button } from "@/components/ui/button";
//     import { Input } from "@/components/ui/input";
//     import { useToast } from "@/components/ui/use-toast";

export function ConciergeChatForm() {
  const [message, setMessage] = useState("");
  const { loading, error, response, send } = useConciergeChat();
  // const { toast } = useToast();
  const { plan, loading: planLoading, error: planError, createPlan } = useConciergePlan();

  async function handleCreatePlan() {
    if (!message.trim()) return;

    await createPlan({
      message: message.trim(),
      lat: 35.71, // TODO: 実際の現在地に差し替え
      lng: 139.8,
      // transport: "walk", // 型にあれば追加
    });
  }

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
          disabled={loading || planLoading}
        />
        <button type="submit" disabled={loading || !message.trim()} className="px-3 py-1 border rounded">
          {loading ? "送信中…" : "送信"}
        </button>
      </form>

      {/* プラン作成ボタン */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleCreatePlan}
          disabled={planLoading || !message.trim()}
          className="px-3 py-1 border rounded text-sm"
        >
          {planLoading ? "プラン作成中…" : "この内容で参拝プランを作る"}
        </button>
      </div>

      {/* チャットのエラー */}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* プランのエラー */}
      {planError && <p className="text-sm text-red-600">{planError}</p>}

      {/* チャットの返信 */}
      {replyText && !error && (
        <div className="rounded border p-3 text-sm bg-white">
          <div className="font-semibold mb-1">コンシェルジュからの回答</div>
          <p>{replyText}</p>
        </div>
      )}

      {/* プランの結果 */}
      {plan && (
        <div className="rounded border p-3 text-sm bg-white space-y-2">
          <div className="font-semibold mb-1">参拝プラン</div>
          {plan.summary && <p className="mb-2">{plan.summary}</p>}

          <div className="space-y-2">
            {plan.spots.map((spot, idx) => (
              <div key={idx} className="border rounded p-2">
                <div className="font-semibold">{spot.name}</div>
                {spot.reason && <div className="text-xs text-slate-700 mt-1">{spot.reason}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
