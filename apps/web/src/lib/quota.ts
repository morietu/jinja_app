const KEY = "concierge_quota_v1";

type Store = {
  date: string; // YYYY-MM-DD（ローカル日付）
  used: number;
};

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { date: todayStr(), used: 0 };
    const s = JSON.parse(raw) as Store;
    if (s.date !== todayStr()) return { date: todayStr(), used: 0 };
    return s;
  } catch {
    return { date: todayStr(), used: 0 };
  }
}

function save(s: Store) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

/** 表示用の残回数。実際の強制はサーバー側で 429 を返す。 */
export function getRemaining(limitPerDay: number): number {
  const s = load();
  return Math.max(0, limitPerDay - s.used);
}

export function consume(limitPerDay: number): {
  ok: boolean;
  remaining: number;
} {
  const s = load();
  if (s.used >= limitPerDay) return { ok: false, remaining: 0 };
  s.used += 1;
  save(s);
  return { ok: true, remaining: Math.max(0, limitPerDay - s.used) };
}

/** 429等を受けたときにズレを補正したい場合に任意で使う */
export function setUsed(value: number) {
  save({ date: todayStr(), used: Math.max(0, value) });
}
