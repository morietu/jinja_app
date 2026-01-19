// apps/web/src/features/concierge/sections/types.ts
export type ConciergeSectionsPayload = {
  version: 1;
  
  sections: readonly ConciergeSection[];
};

export type ConciergeSection =
  | { type: "guide"; text: string }
  | {
      type: "recommendations";
      title?: string;
      items: readonly (RegisteredShrineItem | PlaceShrineItem)[];
    }
  | {
      type: "actions";
      items: readonly { action: "add_condition" | "open_map"; label: string }[];
    };

export type RegisteredShrineItem = {
  kind: "registered";
  shrineId: number;
  title: string;
  address?: string | null;
  description: string;
  imageUrl?: string | null;
  goriyakuTags?: readonly { id: number; name: string }[];
  initialFav?: boolean;
};

export type PlaceShrineItem = {
  kind: "place";
  placeId: string;
  title: string;
  address?: string | null;
  description: string;
  imageUrl?: string | null;
};
