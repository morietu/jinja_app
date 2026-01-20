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
};

function hasText(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function pickAClauseFromShrine(s: Shrine): string {
  let result = "少し立ち止まって考えたい人には";

  const e = (s as any)?.element;

  if (hasText(e)) {
    result = "雰囲気や相性を大切にしたい人には";
  } else if (typeof e === "number" && Number.isFinite(e)) {
    result = "雰囲気や相性を大切にしたい人には";
  }

  return result;
}

export function buildShrineExplanation({ shrine, publicCount = 0 }: Args): Result {
  const desc = hasText((shrine as any)?.description) ? String((shrine as any).description).trim() : "";

  const A = pickAClauseFromShrine(shrine);

  // 「説明が薄い」時の安全な既定文
  const baseFit = `${A}、選択肢として検討しやすい神社です。`;
  const baseHowto = "判断を急がず、状況を整理するための参拝として使われることがあります。";
  const baseNote =
    "合うかどうかは、その日の状態や目的で変わることがあります。無理に意味づけせず、判断材料として使うのが自然です。";
  const baseUnfit = "即効性や強い確信を求めると、期待とずれることがあります。";

  const refHint = publicCount >= 3 ? "公開御朱印があるため、参拝のイメージをつかむ材料が比較的そろっています。" : null;

  // description がある場合は「要点」を短く足す（ただし断定しない）
  const fit = desc ? `${baseFit}（要点：${desc.slice(0, 48)}${desc.length > 48 ? "…" : ""}）` : baseFit;

  const howto = refHint ? `${baseHowto} ${refHint}` : baseHowto;

  return {
    fit,
    unfit: baseUnfit,
    howto,
    note: baseNote,
  };
}
