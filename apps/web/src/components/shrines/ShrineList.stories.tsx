// src/components/shrines/ShrineList.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { ShrineList, type ShrineListItem } from "./ShrineList";
import { ShrineCardSkeleton } from "./ShrineCardSkeleton";
import sample from "@/viewmodels/concierge/fixtures/concierge.sample.json";
import { conciergeToShrineListItems, type ConciergeResponse } from "@/viewmodels/conciergeToShrineList";

const baseItem: ShrineListItem = {
  id: "chi_a",
  cardProps: {
    name: "浅草神社",
    address: "東京都台東区浅草2-3-1",
    distanceM: 420,
    rating: 4.5,
    reviewCount: 1234,
    imageUrl: "https://placehold.co/320x240",
    tags: ["縁結び", "金運", "厄除け"],
    href: "/shrines/chi_a",
    isFavorited: false,
    onToggleFavorite: () => {},
  },
};

const meta = {
  title: "Shrines/ShrineList",
  component: ShrineList,
  args: {
    variant: "list",
    items: [baseItem],
  },
} satisfies Meta<typeof ShrineList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DefaultList: Story = {};

export const Grid: Story = {
  args: {
    variant: "grid",
    items: [
      baseItem,
      { ...baseItem, id: "chi_b", cardProps: { ...baseItem.cardProps, name: "明治神宮", href: "/shrines/chi_b" } },
      { ...baseItem, id: "chi_c", cardProps: { ...baseItem.cardProps, name: "神田明神", href: "/shrines/chi_c" } },
      { ...baseItem, id: "chi_d", cardProps: { ...baseItem.cardProps, name: "日枝神社", href: "/shrines/chi_d" } },
      { ...baseItem, id: "chi_e", cardProps: { ...baseItem.cardProps, name: "富岡八幡宮", href: "/shrines/chi_e" } },
      { ...baseItem, id: "chi_f", cardProps: { ...baseItem.cardProps, name: "根津神社", href: "/shrines/chi_f" } },
    ],
  },
};

export const Empty: Story = {
  args: {
    items: [],
    emptyText: "検索結果が0件でした",
  },
};

export const Mixed: Story = {
  args: {
    variant: "list",
    items: [
      baseItem,
      {
        id: "chi_b",
        cardProps: {
          ...baseItem.cardProps,
          name: "画像なし神社",
          imageUrl: null,
          href: "/shrines/chi_b",
        },
      },
      {
        id: "chi_c",
        cardProps: {
          ...baseItem.cardProps,
          name: "めちゃくちゃ長い神社名".repeat(8),
          href: "/shrines/chi_c",
        },
      },
      {
        id: "chi_d",
        cardProps: {
          ...baseItem.cardProps,
          address: "東京都台東区浅草2-3-1 ".repeat(8),
          href: "/shrines/chi_d",
        },
      },
      {
        id: "chi_e",
        cardProps: {
          ...baseItem.cardProps,
          name: "お気に入り済み神社",
          isFavorited: true,
          href: "/shrines/chi_e",
        },
      },
    ],
  },
};

// --- Loading states (Storybook) ---

export const LoadingList: Story = {
  args: {
    variant: "list",
    items: [],
  },
  render: (_args) => (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <ShrineCardSkeleton key={i} />
      ))}
    </div>
  ),
};

export const LoadingGrid: Story = {
  args: {
    variant: "grid",
    items: [],
  },
  render: (_args) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <ShrineCardSkeleton key={i} />
      ))}
    </div>
  ),
};

export const ConciergeFixture: Story = {
  args: {
    variant: "list",
    items: conciergeToShrineListItems(sample as unknown as ConciergeResponse),
  },
};
