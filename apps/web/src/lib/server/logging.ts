// apps/web/src/lib/server/logging.ts
import type { NextRequest } from "next/server";

export type LogLevel = "debug" | "info" | "warn" | "error";

// debug/info を出すのは明示ONのときだけ
export const DEBUG_LOG = process.env.NODE_ENV !== "production" && process.env.DEBUG_LOG === "1";

/**
 * requestId: 既存のヘッダがあれば尊重、なければ生成
 * - NextRequest でも Request でも OK
 */
export function getRequestId(req: Request | NextRequest): string {
  const fromHeader = req.headers.get("x-request-id") || req.headers.get("x-vercel-id") || req.headers.get("cf-ray");
  return fromHeader || crypto.randomUUID();
}

export function serverLog(level: LogLevel, event: string, data: Record<string, unknown> = {}) {
  // prodでも warn/error は出す、debug/info は DEBUG_LOG のときだけ
  if (!DEBUG_LOG && (level === "debug" || level === "info")) return;

  const payload = {
    level,
    event,
    ...data,
    at: new Date().toISOString(),
  };

  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
