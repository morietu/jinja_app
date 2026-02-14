import type { Shrine } from "@/lib/api/shrines";

/** Places候補（resolve/search の戻りに合わせて最低限） */
export type PlacesCandidate = {
  place_id: string;
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  types?: string[];
  rating?: number | null;
  user_ratings_total?: number | null;
};

export type SuggestItem =
  | {
      kind: "db";
      key: string; // "db:<id>"
      shrine: Shrine;
    }
  | {
      kind: "places";
      key: string; // "places:<place_id>"
      place: PlacesCandidate;
    };
