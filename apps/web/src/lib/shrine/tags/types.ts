export type TagType = "deity" | "benefit" | "place" | "feature" | "misc";
export type TagSource = "official" | "rule" | "user" | "manual";
export type Confidence = "high" | "mid" | "low";

export type ShrineTag = {
  id: string;
  label: string;
  type: TagType;
  source: TagSource;
  confidence: Confidence;
};

/**
 * 意味辞書の分類
 */
export type MeaningCategory = "symbol" | "psychological" | "turning_point";

/**
 * 推薦ロジック・UI表示に使う意味辞書エントリ
 */
export type MeaningTag = {
  id: string;
  label: string;
  category: MeaningCategory;
  description: string;
  source: TagSource;
  confidence: Confidence;

  /**
   * 相談側の need とどうつながるか
   * 例: ["courage", "career"]
   */
  relatedNeedTags?: string[];

  /**
   * UIで短く出す補助ラベル
   */
  uiLabel?: string;

  /**
   * 補足説明として出したい文
   */
  note?: string;
};

/**
 * 神社ごとの意味override
 */
export type ShrineMeaningOverride = {
  shrineId: number;
  symbols?: string[];
  psychological?: string[];
  turningPoints?: string[];

  /**
   * この神社で特に強く出す意味
   */
  primarySymbol?: string | null;
  primaryPsychological?: string | null;
  primaryTurningPoint?: string | null;

  /**
   * 1位理由や補足で使う短文
   */
  rankReasonHint?: string | null;
  supplementaryNote?: string | null;
};

/**
 * need と意味辞書の接続マップ
 */
export type NeedMeaningMap = Record<
  string,
  {
    psychological?: string[];
    symbols?: string[];
    turningPoints?: string[];
  }
>;
