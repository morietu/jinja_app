// apps/web/src/lib/shrine/buildDetailCopy.ts
import type { Shrine } from "@/lib/api/shrines";

type CopyBlocks = {
  fit: string; // 合う人
  unfit: string; // 合いにくい人
  howto: string; // 使い方
  caution: string; // 注意
};

function uniq2(arr: string[]) {
  const out: string[] = [];
  for (const a of arr) {
    const s = (a || "").trim();
    if (!s) continue;
    if (!out.includes(s)) out.push(s);
    if (out.length >= 2) break;
  }
  return out;
}

export function buildShrineDetailCopy(shrine: Shrine, benefitLabels: string[]): CopyBlocks {
  const benefits = uniq2(benefitLabels);

  // 合う人（状況・タイミング）
  const fit = benefits.length
    ? `${benefits.join("・")}を意識して動きたい時に、選択肢として検討しやすい神社です。`
    : "少し立ち止まって考えたい時に、選択肢として検討しやすい神社です。";

  // 合いにくい人（逆条件）
  const unfit = "短時間で結論を出したい時は、別の候補のほうが合う場合があります。";

  // 参拝の使い方（行動例）
  const howto = benefits.length
    ? `願いを1つに絞ってから参拝し、終わったあとに「次にやる1手」を1つだけ決めると整理しやすいです。`
    : "参拝後に「次にやる1手」を1つだけ決めると、状況を整理しやすいです。";

  // 注意（断定しない）
  const caution =
    "合うかどうかは、その日の状態や目的で変わることがあります。無理に意味づけせず、判断材料として使うのが自然です。";

  return { fit, unfit, howto, caution };
}
