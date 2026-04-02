// apps/web/src/lib/concierge/conciergeCopyRules.ts

export type ConciergeCopyTone = "soft" | "neutral";

export type ConciergeCopyStructure = {
  maxSentencesPerBlock: number;
  maxCharsPerSentence: number;
  idealCharsPerSentence: number;
};

export type ConciergeCopyStyle = {
  avoidHardWords: boolean;
  avoidTechnicalWords: boolean;
  avoidOverassertion: boolean;
  preferPlainJapanese: boolean;
};

export type ConciergeCopyPreferredPhrases = {
  state: string[];
  meaning: string[];
  connection: string[];
};

export type ConciergeCopyAvoidPhrases = {
  endings: string[];
  connectors: string[];
  tones: string[];
};

export type ConciergeCopyRules = {
  version: string;
  tone: ConciergeCopyTone;
  structure: ConciergeCopyStructure;
  style: ConciergeCopyStyle;
  preferredPhrases: ConciergeCopyPreferredPhrases;
  avoidPhrases: ConciergeCopyAvoidPhrases;
};

export const CONCIERGE_COPY_RULES: ConciergeCopyRules = {
  version: "v1",
  tone: "soft",
  structure: {
    maxSentencesPerBlock: 3,
    maxCharsPerSentence: 40,
    idealCharsPerSentence: 30,
  },
  style: {
    avoidHardWords: true,
    avoidTechnicalWords: true,
    avoidOverassertion: true,
    preferPlainJapanese: true,
  },
  preferredPhrases: {
    state: [
      "〜が続くと、〜しにくくなることがあります。",
      "〜が長く続くと、少し動きづらくなることがあります。",
      "〜が続くと、力が出にくくなることがあります。",
    ],
    meaning: [
      "この神社は、〜の意味を持つ神社です。",
      "この神社には、〜の意味があります。",
      "この神社は、〜を意識しやすい神社です。",
    ],
    connection: [
      "今回の相談には、この意味が近いように見えます。",
      "今回の相談だと、この意味が重なっています。",
      "今のタイミングだと、この意味が近いと思います。",
    ],
  },
  avoidPhrases: {
    endings: ["〜になります", "〜と言われています", "〜と考えられます", "〜といえるでしょう"],
    connectors: ["したがって", "そのため", "一方で", "つまり"],
    tones: ["過度に断定する表現", "説教的な表現", "抽象的すぎる表現"],
  },
};

export function normalizeCopySentence(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function normalizeCopyText(text?: string | null): string {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim();
}

export function splitSentences(text?: string | null): string[] {
  const normalized = normalizeCopyText(text);
  if (!normalized) return [];

  return normalized
    .split(/(?<=。|！|？)/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function countChars(text?: string | null): number {
  return normalizeCopyText(text).length;
}

/**
 * 文単位の文字数をざっくり判定する
 */
export function isWithinSentenceLimit(text: string, max = CONCIERGE_COPY_RULES.structure.maxCharsPerSentence): boolean {
  return text.trim().length <= max;
}

/**
 * 理想文字数に収まっているかを判定する
 */
export function isWithinIdealSentenceLength(
  text: string,
  ideal = CONCIERGE_COPY_RULES.structure.idealCharsPerSentence,
): boolean {
  return text.trim().length <= ideal;
}

/**
 * ブロック内の文数がルール内かを判定する
 */
export function isWithinBlockSentenceLimit(
  sentences: string[],
  max = CONCIERGE_COPY_RULES.structure.maxSentencesPerBlock,
): boolean {
  return sentences.filter((sentence) => sentence.trim().length > 0).length <= max;
}

export function isSentenceWithinLimit(
  text?: string | null,
  maxChars = CONCIERGE_COPY_RULES.structure.maxCharsPerSentence,
): boolean {
  return countChars(text) <= maxChars;
}

export function isBlockWithinSentenceLimit(
  text?: string | null,
  maxSentences = CONCIERGE_COPY_RULES.structure.maxSentencesPerBlock,
): boolean {
  return splitSentences(text).length <= maxSentences;
}

export function findHardPhrases(text?: string | null): string[] {
  const normalized = normalizeCopyText(text);
  if (!normalized) return [];

  const targets = [...CONCIERGE_COPY_RULES.avoidPhrases.endings, ...CONCIERGE_COPY_RULES.avoidPhrases.connectors].map(
    (phrase) => phrase.replace(/〜/g, ""),
  );

  return targets.filter((phrase) => phrase && normalized.includes(phrase));
}

export function trimSentenceToMaxChars(
  text?: string | null,
  maxChars = CONCIERGE_COPY_RULES.structure.maxCharsPerSentence,
): string {
  const normalized = normalizeCopyText(text);
  if (!normalized) return "";
  if (normalized.length <= maxChars) return normalized;

  return `${normalized.slice(0, maxChars).trim()}…`;
}

export function trimBlockToMaxSentences(
  text?: string | null,
  maxSentences = CONCIERGE_COPY_RULES.structure.maxSentencesPerBlock,
): string {
  const sentences = splitSentences(text);
  if (sentences.length <= maxSentences) {
    return sentences.join("");
  }

  return sentences.slice(0, maxSentences).join("");
}

export function sanitizeCopyText(text?: string | null): string {
  const trimmedBlock = trimBlockToMaxSentences(text);
  const sentences = splitSentences(trimmedBlock);

  const normalizedSentences = sentences.map((sentence) => trimSentenceToMaxChars(sentence));
  return normalizedSentences.join("");
}

export function isSoftEnough(text?: string | null): boolean {
  return findHardPhrases(text).length === 0;
}
