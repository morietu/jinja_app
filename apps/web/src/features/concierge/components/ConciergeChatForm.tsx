// src/features/concierge/components/ConciergeChatForm.tsx
"use client";

import { FormEvent, useState } from "react";
import { useConciergeChat } from "../hooks/useConciergeChat";
import { useConciergePlan } from "../hooks/useConciergePlan";
import type { ConciergeChatRequest } from "../types";
import type { ConciergePlanResponse } from "@/api/conciergePlan";

// spots の1件分の型
type PlanSpot = ConciergePlanResponse["spots"][number];

export function ConciergeChatForm() {
  const [message, setMessage] = useState("");

  const { loading: chatLoading, error: chatError, response, send } = useConciergeChat();

  const { plan, loading: planLoading, error: planError, createPlan } = useConciergePlan();

  const isBusy = chatLoading || planLoading;
  const hasMessage = message.trim().length > 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!hasMessage) return;

    const payload: ConciergeChatRequest = {
      message: message.trim(),
      // TODO: 実際の現在地に差し替え
      lat: 35.71,
      lng: 139.8,
    };

    await send(payload);
  }

  async function handleCreatePlan() {
    if (!hasMessage) return;

    await createPlan({
      message: message.trim(),
      // TODO: 実際の現在地に差し替え
      lat: 35.71,
      lng: 139.8,
      // transport: "walk", // 必要になったら型を見て追加
    });
  }

  const replyText = response?.reply ?? response?.data?.messages?.find((m) => m.role === "assistant")?.content ?? "";

  return (
    <div className="space-y-4">
      {/* 入力＋チャット送信 */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          className="flex-1 border rounded px-2 py-1"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="神社の相談を入力してください…"
          disabled={isBusy}
        />
        <button type="submit" disabled={isBusy || !hasMessage} className="px-3 py-1 border rounded">
          {chatLoading ? "送信中…" : "相談する"}
        </button>
      </form>

      {/* プラン作成ボタン */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleCreatePlan}
          disabled={planLoading || !hasMessage}
          className="px-3 py-1 border rounded text-sm"
        >
          {planLoading ? "プラン作成中…" : "この内容で参拝プランを作る"}
        </button>
      </div>

      {/* エラー表示 */}
      {chatError && <p className="text-sm text-red-600">{chatError}</p>}
      {planError && <p className="text-sm text-red-600">{planError}</p>}

      {/* チャットの返信 */}
      {replyText && !chatError && (
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

          <ul className="space-y-2">
            {plan.spots.map((spot: PlanSpot, idx: number) => (
              <li key={spot.place_id ?? idx} className="border rounded p-2">
                <div className="font-semibold">{spot.name}</div>
                {spot.reason && <div className="text-xs text-slate-700 mt-1">{spot.reason}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
