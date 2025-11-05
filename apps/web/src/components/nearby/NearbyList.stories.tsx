import type { Meta, StoryObj } from "@storybook/react";
import { NearbyList } from "./NearbyList";

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
      { id: "1", name: "明治神宮", distanceMeters: 850, durationMinutes: 12, address: "東京都渋谷区" },
      { id: "2", name: "神田明神", distanceMeters: 2300, durationMinutes: 28, address: "東京都千代田区" },
    ],
  },
};
