// apps/web/src/lib/shrine/buildShrineExplanation.ts
import type { Shrine } from "@/lib/api/shrines";

type Args = {
  shrine: Shrine;
  publicCount?: number;
};

type Result = {
  fit: string;
  unfit: string;
  howto: string;
  note: string;
  hasSignal: boolean;
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

// ✅ 文言はトップレベル定数でOK（依存なし）
const BASE_UNFIT = "判断材料の一つとして、前提とあわせて参考にしてください。";
const NUANCED_UNFIT = "判断の前提によっては、特徴の受け取り方が変わるため、判断材料の一つとして参考にしてください。";

export function buildShrineExplanation({ shrine, publicCount = 0 }: Args): Result {
  const desc = hasText((shrine as any)?.description) ? String((shrine as any).description).trim() : "";

  const A = pickAClauseFromShrine(shrine);

  const baseFit = `${A}、選択肢として検討しやすい神社です。`;
  const baseHowto = "判断を急がず、状況を整理するための参拝として使われることがあります。";
  const baseNote =
    "合うかどうかは、その日の状態や目的で変わることがあります。無理に意味づけせず、判断材料として使うのが自然です。";

  const views30d = Number((shrine as any)?.views_30d ?? 0);
  const fav30d = Number((shrine as any)?.favorites_30d ?? 0);

  const hasSignal =
    hasText((shrine as any)?.description) ||
    hasText((shrine as any)?.element) ||
    (typeof (shrine as any)?.element === "number" && Number.isFinite((shrine as any).element)) ||
    publicCount >= 3 ||
    (Number.isFinite(views30d) && views30d >= 30) ||
    (Number.isFinite(fav30d) && fav30d >= 3);

  const unfit = hasSignal ? NUANCED_UNFIT : BASE_UNFIT;

  const refHint = publicCount >= 3 ? "公開御朱印があるため、参拝のイメージをつかむ材料が比較的そろっています。" : null;

  const fit = desc ? `${baseFit}（要点：${desc.slice(0, 48)}${desc.length > 48 ? "…" : ""}）` : baseFit;

  const howto = refHint ? `${baseHowto} ${refHint}` : baseHowto;

  return {
    fit,
    unfit,
    howto,
    note: baseNote,
    hasSignal,
  };
}
