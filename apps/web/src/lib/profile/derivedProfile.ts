export type ProfileInput = {
  birthday?: string | null;
  birth_time?: string | null;
  birth_place?: string | null;
};

export type DerivedProfile = {
  kyusei?: string;
  gogyo?: string;
  lifePath?: string;
};
export type DirectionProfile = { luckyDirection?: string; luckyDirections?: string[]; targetYear?: number; calculationMethod?: "annual_kyusei_v1"; excludedDirections?: string[]; source?: "calculated" };

export function normalizeBirthday(value?: string | null): string | undefined {
  const match = value?.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  if (
    year < 1900 ||
    date.getTime() > todayUtc ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return undefined;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function calculateLifePath(birthday: string): string {
  const normalized = normalizeBirthday(birthday);
  if (!normalized) return "";
  let sum = normalized.replace(/-/g, "").split("").reduce((total, digit) => total + Number(digit), 0);
  while (sum > 9 && sum !== 11 && sum !== 22) {
    sum = String(sum).split("").reduce((total, digit) => total + Number(digit), 0);
  }
  return String(sum);
}

export function calculateKyusei(birthday: string): string {
  const normalized = normalizeBirthday(birthday);
  if (!normalized) return "";
  const year = Number(normalized.slice(0, 4));
  const star = ((11 - (year % 9)) % 9) || 9;
  return ["", "一白水星", "二黒土星", "三碧木星", "四緑木星", "五黄土星", "六白金星", "七赤金星", "八白土星", "九紫火星"][star];
}

const KYUSEI_TO_GOGYO: Record<string, string> = {
  一白水星: "水", 二黒土星: "土", 三碧木星: "木", 四緑木星: "木", 五黄土星: "土",
  六白金星: "金", 七赤金星: "金", 八白土星: "土", 九紫火星: "火",
};

type Direction = "北" | "北東" | "東" | "南東" | "南" | "南西" | "西" | "北西";
const PALACE_BY_DIRECTION: Record<Direction, number> = { 北: 1, 北東: 8, 東: 3, 南東: 4, 南: 9, 南西: 2, 西: 7, 北西: 6 };
const OPPOSITE: Record<Direction, Direction> = { 北: "南", 北東: "南西", 東: "西", 南東: "北西", 南: "北", 南西: "北東", 西: "東", 北西: "南東" };
const STAR_ELEMENT: Record<number, string> = { 1: "水", 2: "土", 3: "木", 4: "木", 5: "土", 6: "金", 7: "金", 8: "土", 9: "火" };
const GENERATES: Record<string, string> = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
const DIRECTIONS = Object.keys(PALACE_BY_DIRECTION) as Direction[];
const starNumberForYear = (year: number) => ((11 - (year % 9) - 1) % 9) + 1;
const annualStarAt = (direction: Direction, centerStar: number) => ((centerStar + PALACE_BY_DIRECTION[direction] - 5 - 1 + 18) % 9) + 1;
const taisaiDirection = (year: number) => (["北", "北東", "北東", "東", "南東", "南東", "南", "南西", "南西", "西", "北西", "北西"] as Direction[])[((year - 4) % 12 + 12) % 12];

export function buildDirectionProfile(profile: ProfileInput, referenceDate = new Date()): DirectionProfile {
  const normalized = normalizeBirthday(profile.birthday);
  if (!normalized) return {};
  const [birthYear, birthMonth, birthDay] = normalized.split("-").map(Number);
  const honmeiYear = birthMonth < 2 || (birthMonth === 2 && birthDay < 4) ? birthYear - 1 : birthYear;
  const honmeiStar = starNumberForYear(honmeiYear);
  const year = referenceDate.getMonth() < 1 || (referenceDate.getMonth() === 1 && referenceDate.getDate() < 4) ? referenceDate.getFullYear() - 1 : referenceDate.getFullYear();
  const centerStar = starNumberForYear(year);
  const starByDirection = Object.fromEntries(DIRECTIONS.map((direction) => [direction, annualStarAt(direction, centerStar)])) as Record<Direction, number>;
  const fiveYellow = DIRECTIONS.find((direction) => starByDirection[direction] === 5);
  const honmeiDirection = DIRECTIONS.find((direction) => starByDirection[direction] === honmeiStar);
  const exclusions = new Set<Direction>();
  if (fiveYellow) { exclusions.add(fiveYellow); exclusions.add(OPPOSITE[fiveYellow]); }
  if (honmeiDirection) { exclusions.add(honmeiDirection); exclusions.add(OPPOSITE[honmeiDirection]); }
  exclusions.add(OPPOSITE[taisaiDirection(year)]);
  const honmeiElement = STAR_ELEMENT[honmeiStar];
  const luckyDirections = DIRECTIONS.filter((direction) => {
    if (exclusions.has(direction)) return false;
    const element = STAR_ELEMENT[starByDirection[direction]];
    return element === honmeiElement || GENERATES[element] === honmeiElement || GENERATES[honmeiElement] === element;
  });
  return { luckyDirection: luckyDirections[0], luckyDirections, targetYear: year, calculationMethod: "annual_kyusei_v1", excludedDirections: DIRECTIONS.filter((direction) => exclusions.has(direction)), source: "calculated" };
}

export function buildDerivedProfile(profile: ProfileInput): DerivedProfile {
  const birthday = normalizeBirthday(profile.birthday);
  if (!birthday) return { kyusei: undefined, gogyo: undefined, lifePath: undefined };
  const kyusei = calculateKyusei(birthday);
  return { kyusei, gogyo: KYUSEI_TO_GOGYO[kyusei] ?? "不明", lifePath: calculateLifePath(birthday) };
}

export function buildProfileContext(profile: ProfileInput) {
  const derived = buildDerivedProfile(profile);
  return {
    user_profile: {
      birthday: normalizeBirthday(profile.birthday),
      birthdate: normalizeBirthday(profile.birthday),
      birthTime: profile.birth_time || undefined,
      birthPlace: profile.birth_place || undefined,
    },
    derived_profile: derived,
  };
}
