// apps/web/src/features/concierge/types/sections.ts
import type { ConciergeRecommendation } from "@/lib/api/concierge";

export type ConciergeSection = {
  kind: "primary";
  title: string;
  items: ConciergeRecommendation[];
  needTags?: string[]; // ✅ 追加（任意）
};
