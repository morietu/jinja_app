// conciergeResultItem.ts
import type { ShrineConciergeCardProps } from "@/components/shrines/ShrineConciergeCard";

export type ConciergeResultItem = {
  id: string;
  tid?: string | null;
  cardProps: ShrineConciergeCardProps;
};
