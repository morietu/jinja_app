export type TagType = "deity" | "benefit" | "place" | "feature" | "misc";
export type TagSource = "official" | "rule" | "user" | "manual";
export type Confidence = "high" | "mid" | "low";

export type ShrineTag = {
  id: string; // 安定ID（slug化は後でOK）
  label: string; // 表示名（例: "縁結び"）
  type: TagType;
  source: TagSource;
  confidence: Confidence;
};
