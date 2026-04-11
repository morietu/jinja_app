// apps/web/src/lib/log/concierge.ts
export type ConciergeLogEvent =
  | "entry_view"
  | "entry_send"
  | "unified_received"
  | "thread_missing"
  | "error"
  | "filter_apply"
  | "filter_clear"
  | "close"
  | "back_to_entry"
  | "filter_close"
  | "save_concierge_thread_click";

type LogItem = {
  at: string;
  event: ConciergeLogEvent;
  tid: number;
  path: string;
  meta?: Record<string, unknown>;
  level?: "info" | "warn" | "error";
};

type Metrics = {
  entry: {
    attempts: number;
    success: number;
    fail: number;
    pending: boolean;
    pending_from_entry?: boolean; // ✅ 追加
  };
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
    entry: { attempts: 0, success: 0, fail: 0, pending: false, pending_from_entry: false },
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

  const path = typeof window !== "undefined" ? window.location.pathname + window.location.search : "";

  // ✅ 入口判定はログ側で強制（tidが無ければ入口）
  const isEntryRoute =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tid") == null : false;

  // ✅ metaはここで上書きして「嘘」を入れられないようにする
  const meta = { ...(payload.meta ?? {}), isEntryRoute };

  // counts
  m.counts[event] = (m.counts[event] ?? 0) + 1;

  // entry metrics（ここからは meta.isEntryRoute を信じてOK）
  if (event === "entry_send") {
    m.entry.attempts += 1;
    m.entry.pending = true;
    m.entry.pending_from_entry = meta.isEntryRoute === true;
  }
  if (event === "unified_received") {
    if (m.entry.pending && m.entry.pending_from_entry) {
      m.entry.success += 1;
      m.entry.pending = false;
      m.entry.pending_from_entry = false;
    }
  }
  if (event === "thread_missing" || event === "error") {
    if (m.entry.pending && m.entry.pending_from_entry) {
      m.entry.fail += 1;
      m.entry.pending = false;
      m.entry.pending_from_entry = false;
    }
  }

  const item: LogItem = {
    at: nowISO(),
    event,
    tid: payload.tid,
    path,
    meta,
    level: payload.level ?? "info",
  };

  m.logs = [item, ...(m.logs ?? [])].slice(0, MAX_LOGS);
  write(m);
}
