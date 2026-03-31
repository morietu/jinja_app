// conciergeResultItem.ts
export type ConciergeResultItem = {
  id: string;
  tid: string | null;
  cardProps: {
    shrineId: number;
    title: string;
    address?: string;
    imageUrl?: string | null;
    explanationSummary?: string | null;
    explanationPrimaryReason?: string | null;
    breakdown?: any | null;
    badgesOverride?: string[];
  };
  deepReason?: {
    interpretation: string | null;
    shrineMeaning: string | null;
    action: string | null;
    short: string | null;
  };
};
