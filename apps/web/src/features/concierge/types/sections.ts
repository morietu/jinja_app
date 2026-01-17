import type { ConciergeRecommendation } from "@/lib/api/concierge";

export type ConciergeSection =
  | {
      kind: "primary";
      title: string;
      items: ConciergeRecommendation[];
      initialIndex?: number;
      needTags?: string[];
    }
  | {
      kind: "note";
      title: string;
      text: string;
    };
