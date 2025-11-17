// src/features/concierge/api.ts
import type { ConciergeChatRequest, ConciergeChatResponse } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000/api";

export async function postConciergeChat(
  payload: ConciergeChatRequest,
  options: { signal?: AbortSignal } = {},
): Promise<{ status: number; body: ConciergeChatResponse }> {
  const res = await fetch(`${API_BASE}/concierge/chat/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: options.signal,
  });

  let body: ConciergeChatResponse;
  try {
    body = (await res.json()) as ConciergeChatResponse;
  } catch {
    body = { detail: "サーバーからのレスポンスを解釈できませんでした。" } as ConciergeChatResponse;
  }

  return { status: res.status, body };
}
