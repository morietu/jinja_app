import type { Shrine } from "@/lib/api/shrines";

type Args = {
  shrine: Shrine;
  signals?: {
    publicGoshuinsCount?: number;
    views30d?: number;
    fav30d?: number;
  };
};

export type SignalLevel = "weak" | "medium" | "strong";

export type ShrineExplanation = {
  fit: string;
  unfit: string;
  howto: string;
  note: string;
  hasSignal: boolean;
  signalLevel: SignalLevel;
  summary: string;
  strongHint?: string;
  signals?: {
    publicGoshuinsCount?: number;
    views30d?: number;
    fav30d?: number;
  };
};

function hasText(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function pickAClauseFromShrine(s: Shrine): string {
  const e = (s as any)?.element;
  if (hasText(e)) return "雰囲気や相性を大切にしたい人には";
  if (typeof e === "number" && Number.isFinite(e)) return "雰囲気や相性を大切にしたい人には";
  return "少し立ち止まって考えたい人には";
}

// ✅ 固定3文言（この後触らない）
function buildSummary(args: { hasSignal: boolean; level: SignalLevel }): string {
  if (!args.hasSignal) return "情報が少ないため、現時点では判断材料の目安として表示しています。";
  if (args.level === "strong") return "参考になる参拝例が複数あり、おすすめしやすい神社です。";
  if (args.level === "medium") return "いくつかの傾向から、検討の参考として提案しています。";
  return "情報が少ないため、現時点では判断材料の目安として表示しています。";
}

function buildStrongHint(args: { publicCount: number; views30d: number; fav30d: number }): string | null {
  const reasons: string[] = [];
  if (args.publicCount >= 5) reasons.push("公開御朱印が複数あります");
  if (args.views30d >= 100) reasons.push("閲覧が多い傾向があります");
  if (args.fav30d >= 5) reasons.push("お気に入りが多い傾向があります");
  return reasons.length ? reasons.join(" / ") : null;
}

const BASE_UNFIT = "判断材料の一つとして、前提とあわせて参考にしてください。";
const NUANCED_UNFIT = "判断の前提によっては、特徴の受け取り方が変わるため、判断材料の一つとして参考にしてください。";


export function buildShrineExplanation(args: { shrine: Shrine; signals?: ShrineExplanation["signals"] }) {
  const { shrine, signals } = args;
  const desc = hasText((shrine as any)?.description) ? String((shrine as any).description).trim() : "";

  const publicCount = Number(signals?.publicGoshuinsCount ?? 0);
  const views30d = Number(signals?.views30d ?? (shrine as any)?.views_30d ?? 0);
  const fav30d = Number(signals?.fav30d ?? (shrine as any)?.favorites_30d ?? 0);

  const A = pickAClauseFromShrine(shrine);

  const baseFit = `${A}、選択肢として検討しやすい神社です。`;
  const baseHowto = "判断を急がず、状況を整理するための参拝として使われることがあります。";
  const baseNote =
    "合うかどうかは、その日の状態や目的で変わることがあります。無理に意味づけせず、判断材料として使うのが自然です。";

  const hasSignal =
    hasText((shrine as any)?.description) ||
    hasText((shrine as any)?.element) ||
    (typeof (shrine as any)?.element === "number" && Number.isFinite((shrine as any).element)) ||
    publicCount >= 3 ||
    (Number.isFinite(views30d) && views30d >= 30) ||
    (Number.isFinite(fav30d) && fav30d >= 3);

  const unfit = hasSignal ? NUANCED_UNFIT : BASE_UNFIT;
  const refHint = publicCount >= 3 ? "公開御朱印があるため、参拝の雰囲気をつかむ手がかりがあります。" : null;

  const fit = desc ? `${baseFit}（要点：${desc.slice(0, 48)}${desc.length > 48 ? "…" : ""}）` : baseFit;
  const howto = refHint ? `${baseHowto} ${refHint}` : baseHowto;

  let signalLevel: SignalLevel = "weak";
  if (publicCount >= 5 || fav30d >= 5 || views30d >= 100) signalLevel = "strong";
  else if (publicCount >= 3 || fav30d >= 3 || views30d >= 30 || hasText((shrine as any)?.description))
    signalLevel = "medium";

  const summary = buildSummary({ hasSignal, level: signalLevel });
  const strongHint = signalLevel === "strong" ? buildStrongHint({ publicCount, views30d, fav30d }) : null;

  return {
    fit,
    unfit,
    howto,
    note: baseNote,
    hasSignal,
    signalLevel,
    summary,
    strongHint,
    signals,
  } satisfies ShrineExplanation;
}
