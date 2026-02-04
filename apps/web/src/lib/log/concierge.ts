// apps/web/src/lib/log/concierge.ts
export type ConciergeLogEvent =
  | "entry_send"
  | "unified_received"
  | "thread_missing"
  | "error"
  | "filter_apply"
  | "filter_clear"
  | "close";

type LogItem = {
  at: string;
  event: ConciergeLogEvent;
  tid: number;
  path: string;
  meta?: Record<string, unknown>;
  level?: "info" | "warn" | "error";
};

type Metrics = {
  entry: { attempts: number; success: number; fail: number; pending: boolean };
  counts: Record<string, number>;
  logs: LogItem[];
};

const LS_KEY = "concierge:metrics";
const LS_DEBUG_KEY = "debug:concierge";
const MAX_LOGS = 50;

function isEnabled(): boolean {
  try {
    return typeof window !== "undefined" && localStorage.getItem(LS_DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

function nowISO() {
  return new Date().toISOString();
}

export function readConciergeMetrics(): Metrics {
  const base: Metrics = {
    entry: { attempts: 0, success: 0, fail: 0, pending: false },
    counts: {},
    logs: [],
  };

  if (typeof window === "undefined") return base;

  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Metrics>;
    return {
      entry: { ...base.entry, ...(parsed.entry ?? {}) },
      counts: { ...base.counts, ...(parsed.counts ?? {}) },
      logs: Array.isArray(parsed.logs) ? (parsed.logs as LogItem[]) : [],
    };
  } catch {
    return base;
  }
}

export function clearConciergeMetrics() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    // noop
  }
}

function write(m: Metrics) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(m));
  } catch {
    // noop
  }
}

export function conciergeLog(
  event: ConciergeLogEvent,
  payload: { tid: number; meta?: Record<string, unknown>; level?: "info" | "warn" | "error" },
) {
  if (!isEnabled()) return;
  const m = readConciergeMetrics();

  // counts
  m.counts[event] = (m.counts[event] ?? 0) + 1;

  // entry metrics
  if (event === "entry_send") {
    m.entry.attempts += 1;
    m.entry.pending = true;
  }
  if (event === "unified_received") {
    // 入口送信後に unified が返ったら success 扱い
    if (m.entry.pending) {
      m.entry.success += 1;
      m.entry.pending = false;
    }
  }
  if (event === "thread_missing" || event === "error") {
    if (m.entry.pending) {
      m.entry.fail += 1;
      m.entry.pending = false;
    }
  }

  const path = typeof window !== "undefined" ? window.location.pathname + window.location.search : "";

  const item: LogItem = {
    at: nowISO(),
    event,
    tid: payload.tid,
    path,
    meta: payload.meta,
    level: payload.level ?? "info",
  };

  m.logs = [item, ...(m.logs ?? [])].slice(0, MAX_LOGS);
  write(m);
}
