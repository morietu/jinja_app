import type { Meta, StoryObj } from "@storybook/react";
import { NearbyList } from "./NearbyList";
import type { NearbyItem } from "./types";

const meta: Meta<typeof NearbyList> = {
  title: "Nearby/NearbyList",
  component: NearbyList,
  args: { lat: 35.68, lng: 139.76, limit: 20, className: "space-y-3" },
};
export default meta;

type S = StoryObj<typeof NearbyList>;

export const Loading: S = { args: { state: "loading" } };
export const Empty: S = { args: { state: "empty" } };
export const Error: S = { args: { state: "error", errorMessage: "ネットワークエラー" } };

export const Success: S = {
  args: {
    state: "success",
    items: [
      {
        kind: "place",
        place_id: "p1",
        title: "明治神宮",
        subtitle: "東京都渋谷区",
        lat: 35.68,
        lng: 139.76,
        distance_m: 850,
        rating: null,
        user_ratings_total: null,
        icon: null,
      },
      {
        kind: "place",
        place_id: "p2",
        title: "神田明神",
        subtitle: "東京都千代田区",
        lat: 35.695,
        lng: 139.768,
        distance_m: 2300,
        rating: null,
        user_ratings_total: null,
        icon: null,
      },
    ] satisfies NearbyItem[],
  },
};
