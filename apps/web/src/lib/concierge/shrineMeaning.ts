// apps/web/src/lib/concierge/shrineMeaning.ts
export type ShrineMeaningTone = "strong" | "quiet" | "tight" | "neutral";

export type ShrineMeaning = {
  aliases: string[];
  tone: ShrineMeaningTone;
  keywords: string[];
  interpretationHints?: string[];
  meaningSentence: string;
  actionSentence: string;
};

export const SHRINE_MEANINGS: ShrineMeaning[] = [
  {
    aliases: ["三峯神社"],
    tone: "strong",
    keywords: ["決断", "覚悟", "流れを変える"],
    interpretationHints: ["停滞", "動き出し", "切り替え"],
    meaningSentence: "三峯神社は、止まった流れを切り替えたい時の決断や覚悟に重ねやすい神社です。",
    actionSentence: "迷いを引きずるより、一度流れを変える節目として参拝を置きたい時に向いています。",
  },
  {
    aliases: ["伊勢神宮", "伊勢神宮（内宮）", "内宮"],
    tone: "quiet",
    keywords: ["原点", "整える", "静けさ"],
    interpretationHints: ["焦り", "巡り", "立て直し"],
    meaningSentence: "伊勢神宮は、焦りを静めて原点に戻りたい時の参拝先として解釈しやすい神社です。",
    actionSentence: "急いで答えを出すより、一度巡りを整え直したい時の参拝に向いています。",
  },
  {
    aliases: ["乃木神社"],
    tone: "tight",
    keywords: ["集中", "規律", "目標"],
    interpretationHints: ["迷い", "散り", "姿勢"],
    meaningSentence: "乃木神社は、気持ちを引き締めて集中や目標設定に向き合いたい時と相性がよい神社です。",
    actionSentence: "気持ちを散らしたまま進むより、姿勢を整えて目標を定めたい時の参拝に向いています。",
  },
];
