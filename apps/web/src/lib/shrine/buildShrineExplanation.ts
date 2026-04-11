import type { Shrine } from "@/lib/api/shrines";

export type ShrineExplanation = {
  reason: string;
  consultationSummary: string;
  shrineMeaning: string;
  supplement: string;
};

type BuildShrineExplanationArgs = {
  shrine: Shrine;
  signals?: {
    publicGoshuinsCount?: number;
    views30d?: number;
    fav30d?: number;
  };
};

function hasText(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function trimText(v: unknown): string {
  return hasText(v) ? v.trim() : "";
}

function clip(text: string, max = 72): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function getSignalSummary(args: { shrine: Shrine; signals?: BuildShrineExplanationArgs["signals"] }): {
  publicCount: number;
  views30d: number;
  fav30d: number;
  hasSignal: boolean;
} {
  const { shrine, signals } = args;
  const publicCount = Number(signals?.publicGoshuinsCount ?? 0);
  const views30d = Number(signals?.views30d ?? (shrine as any)?.views_30d ?? 0);
  const fav30d = Number(signals?.fav30d ?? (shrine as any)?.favorites_30d ?? 0);

  const hasSignal =
    hasText((shrine as any)?.description) ||
    hasText((shrine as any)?.element) ||
    hasText((shrine as any)?.goriyaku) ||
    hasText((shrine as any)?.sajin) ||
    publicCount >= 3 ||
    views30d >= 30 ||
    fav30d >= 3;

  return {
    publicCount,
    views30d,
    fav30d,
    hasSignal,
  };
}

function buildRankReason(args: BuildShrineExplanationArgs): string {
  const { shrine, signals } = args;
  const { publicCount, views30d, fav30d, hasSignal } = getSignalSummary({ shrine, signals });
  const description = trimText((shrine as any)?.description);
  const element = trimText((shrine as any)?.element);

  const reasons: string[] = [];

  if (description) {
    reasons.push(`神社説明に「${clip(description, 48)}」という特徴があり、今回の相談文脈に接続しやすい神社です。`);
  }

  if (element) {
    reasons.push(`雰囲気や相性の観点では「${element}」の要素があり、今の状態に重ねて見やすい候補です。`);
  }

  if (publicCount >= 3) {
    reasons.push(`公開御朱印が${publicCount}件あり、参拝の雰囲気や受け取られ方を想像しやすい神社です。`);
  }

  if (views30d >= 30 || fav30d >= 3) {
    reasons.push("最近の閲覧や保存の動きもあり、検討候補として情報が集まりやすい神社です。");
  }

  if (!reasons.length && hasSignal) {
    reasons.push("今の相談に対して無理なく重ねやすい材料があり、候補として上位に残した神社です。");
  }

  if (!reasons.length) {
    return "情報はまだ多くありませんが、今の相談文脈に照らして候補として比較しやすい神社です。";
  }

  return reasons[0];
}

function buildConsultationSummary(args: BuildShrineExplanationArgs): string {
  const description = trimText((args.shrine as any)?.description);

  if (description) {
    return "今は答えを急ぐより、状況や気持ちを整理しながら次の見方をつくる段階として読むのが自然です。";
  }

  return "今の相談は、すぐに結論を出すよりも、状態を整えながら優先順位を見直す文脈として整理できます。";
}

function buildShrineMeaning(args: BuildShrineExplanationArgs): string {
  const shrine = args.shrine;
  const description = trimText((shrine as any)?.description);
  const goriyaku = trimText((shrine as any)?.goriyaku);
  const sajin = trimText((shrine as any)?.sajin);

  if (description) {
    return `この神社は「${clip(description, 56)}」という特徴を持ち、今回の相談に対して意味づけしやすい接点があります。`;
  }

  if (goriyaku) {
    return `ご利益として「${clip(goriyaku, 56)}」が見られ、今回の相談テーマとの接続を作りやすい神社です。`;
  }

  if (sajin) {
    return `祭神や由緒の観点では「${clip(sajin, 56)}」が手がかりになり、今の相談を象徴的に受け止めやすい神社です。`;
  }

  return "この神社は、今の状態に対して無理なく意味を重ねやすく、次の見方を作る場として受け取りやすい候補です。";
}

function buildSupplement(args: BuildShrineExplanationArgs): string {
  const { shrine, signals } = args;
  const { publicCount, views30d, fav30d } = getSignalSummary({ shrine, signals });
  const pieces: string[] = [];

  const goriyaku = trimText((shrine as any)?.goriyaku);
  const sajin = trimText((shrine as any)?.sajin);
  const element = trimText((shrine as any)?.element);

  if (goriyaku) {
    pieces.push(`ご利益: ${clip(goriyaku, 56)}`);
  }

  if (sajin) {
    pieces.push(`祭神・由緒: ${clip(sajin, 56)}`);
  }

  if (element) {
    pieces.push(`相性の見立て: ${element}`);
  }

  if (publicCount >= 3) {
    pieces.push(`公開御朱印 ${publicCount}件`);
  }

  if (views30d >= 30) {
    pieces.push(`直近閲覧 ${views30d}`);
  }

  if (fav30d >= 3) {
    pieces.push(`直近保存 ${fav30d}`);
  }

  if (!pieces.length) {
    return "補足情報はまだ多くありませんが、象徴やご利益は現地で受け取る前提で見るのが自然です。";
  }

  return pieces.join(" / ");
}

export function buildShrineExplanation(args: BuildShrineExplanationArgs): ShrineExplanation {
  return {
    reason: buildRankReason(args),
    consultationSummary: buildConsultationSummary(args),
    shrineMeaning: buildShrineMeaning(args),
    supplement: buildSupplement(args),
  };
}
