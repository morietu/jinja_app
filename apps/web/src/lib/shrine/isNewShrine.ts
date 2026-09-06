// apps/web/src/lib/shrine/isNewShrine.ts
//
// /shrines一覧の「新着」バッジ判定。Backendは Shrine.created_at という事実を返すだけで、
// 新着かどうかの判定はこのFrontendのpure functionが正本とする。
//
// 判定規約（Mother Ship確定仕様）:
// - Timezone: Asia/Tokyo
// - 判定粒度: 日単位（時分秒による24時間換算はしない）
// - 表示期間: 追加日を1日目として14日間（JST日付差 0〜13日 → 新着、14日以上 → 非表示）
// - created_atが欠損・不正値の場合はエラーにせず false（一覧表示自体は落とさない）

/** 追加日を1日目として何日間「新着」を表示するか。 */
export const NEW_SHRINE_BADGE_DAYS = 14;

const MS_PER_DAY = 86_400_000;

// formatToPartsでyear/month/dayを個別に読むため、ロケール依存の並び順に影響されない。
const JST_DATE_PARTS_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Asia/Tokyoの暦日を、比較可能な連番（UTC epoch day）へ変換する。
 * 判定不能な場合は null。
 */
function toJstDayNumber(date: Date): number | null {
  if (Number.isNaN(date.getTime())) return null;

  const parts = JST_DATE_PARTS_FORMATTER.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  const year = read("year");
  const month = read("month");
  const day = read("day");

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

  // Date.UTCは0〜99を1900年代へ丸めるため、setUTCFullYearで実年を明示する。
  const utc = new Date(0);
  utc.setUTCFullYear(year, month - 1, day);
  utc.setUTCHours(0, 0, 0, 0);

  return Math.floor(utc.getTime() / MS_PER_DAY);
}

/**
 * created_at が Asia/Tokyo の日付基準で「追加日を含む14日間」以内かを返す。
 *
 * @param createdAt ISO 8601 datetime。undefined / null / 空文字 / 不正値は false。
 * @param now 現在時刻。テストで固定できるよう引数で受ける。
 */
export function isNewShrine(createdAt?: string | null, now: Date = new Date()): boolean {
  if (typeof createdAt !== "string") return false;

  const trimmed = createdAt.trim();
  if (!trimmed) return false;

  const createdDay = toJstDayNumber(new Date(trimmed));
  const nowDay = toJstDayNumber(now);
  if (createdDay === null || nowDay === null) return false;

  const diffDays = nowDay - createdDay;

  return diffDays >= 0 && diffDays < NEW_SHRINE_BADGE_DAYS;
}
