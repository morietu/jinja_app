// apps/web/src/lib/concierge/pickModeFromThread.ts

export type PickedConciergeMode = "need" | "compat" | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Concierge thread から mode を拾う
 * - data._signals.mode.mode を優先
 * - 値が不正なら null
 */
export function pickModeFromThread(thread: unknown): PickedConciergeMode {
  if (!isRecord(thread)) return null;

  const data = isRecord(thread.data) ? thread.data : null;
  const signals = isRecord(data?._signals) ? data!._signals : null;
  const modeObj = isRecord(signals?.mode) ? signals!.mode : null;
  const mode = modeObj?.mode;

  if (mode === "compat") return "compat";
  if (mode === "need") return "need";
  return null;
}
