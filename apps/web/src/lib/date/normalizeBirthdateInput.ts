export function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;

  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;

  const [y, m, dd] = s.split("-").map(Number);
  return d.getUTCFullYear() === y && d.getUTCMonth() + 1 === m && d.getUTCDate() === dd;
}

export function normalizeBirthdateInput(s: string): string | null {
  const t = s.trim().replaceAll("/", "-");
  const m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;

  const y = m[1];
  const mm = m[2].padStart(2, "0");
  const dd = m[3].padStart(2, "0");
  const iso = `${y}-${mm}-${dd}`;

  return isValidISODate(iso) ? iso : null;
}
