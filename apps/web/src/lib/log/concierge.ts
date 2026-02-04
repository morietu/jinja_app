// apps/web/src/lib/log/concierge.ts
type Level = "debug" | "info" | "warn" | "error";

type LogPayload = {
  tid?: number;
  meta?: Record<string, unknown>;
  level?: Level;
};

export function conciergeLog(event: string, payload: LogPayload = {}) {
  // production では静かにする（必要なら後で送信実装に差し替え）
  if (process.env.NODE_ENV === "production") return;

  const level = payload.level ?? "info";
  const msg = `[concierge] ${event}`;

  // eslint の no-console がうるさければ後で調整
  switch (level) {
    case "error":
      console.error(msg, payload);
      return;
    case "warn":
      console.warn(msg, payload);
      return;
    default:
      console.log(msg, payload);
      return;
  }
}
