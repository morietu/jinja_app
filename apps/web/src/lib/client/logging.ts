// apps/web/src/lib/client/logging.ts
export const DEBUG_LOG = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEBUG_LOG === "1";

export function devLog(event: string, data: Record<string, unknown> = {}) {
  if (!DEBUG_LOG) return;
  console.log(`[dev] ${event}`, data);
}

export type ClientLogLevel = "debug" | "info" | "warn" | "error";

/**
 * clientLog: クライアント側の structured log
 * - warn/error は本番でも出す（Error Boundary は特に重要）
 * - debug/info は DEBUG_LOG のときだけ
 */
export function clientLog(level: ClientLogLevel, event: string, data: Record<string, unknown> = {}) {
  if (!DEBUG_LOG && (level === "debug" || level === "info")) return;

  const payload = { level, event, ...data, at: new Date().toISOString() };
  const line = JSON.stringify(payload);

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
