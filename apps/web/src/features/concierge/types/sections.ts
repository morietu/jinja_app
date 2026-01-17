// apps/web/src/features/concierge/types/sections.ts
import type { ConciergeRecommendation } from "@/lib/api/concierge";

export type ConciergeSection =
  | {
      kind: "primary";
      title: string;
      items: ConciergeRecommendation[];
    }
  | {
      kind: "recommendations";
      title?: string;
      items: ConciergeRecommendation[];
    };
