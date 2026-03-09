// src/components/shrines/ShrineList.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { ShrineList, type ShrineListItem } from "./ShrineList";
import { ShrineCardSkeleton } from "./ShrineCardSkeleton";
//import sample from "@/fixtures/concierge.sample.json";
//import { conciergeToShrineListItems, type ConciergeResponse } from "@/viewmodels/conciergeToShrineList";

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

//export const ConciergeFixture: Story = {
  //args: {
    //variant: "list",
    //items: conciergeToShrineListItems(sample as unknown as ConciergeResponse),
  //},
// };

export const ConciergeProductLevel: Story = {
  args: {
    variant: "list",
    headerMessage: "相談内容と近さをもとに、参拝候補を3件に整理しました。",
    notice: "代わりに近い神社を表示しています（条件は反映されていません）",
    items: [
      {
        id: "shrine_10",
        cardProps: {
          name: "神社A",
          address: "東京都千代田区",
          recommendReason: "転機・仕事に向き合う参拝に",
          subReason: "落ち着いて気持ちを整えやすい雰囲気",
          compatibilityLabels: ["転機・仕事", "休息"],
          distanceM: 123,
          imageUrl: "https://placehold.co/320x240",
          tags: ["転機・仕事", "休息"],
          href: "/shrines/10",
          isFavorited: false,
          onToggleFavorite: () => {},
          isTopPick: true,
          explanationSummary: "今の願いごとに向き合う参拝先",
          explanationReasons: [
            {
              code: "NEED_MATCH",
              label: "相談との一致",
              text: "転機・仕事に関する相談内容との一致が見られます。",
              strength: "high",
            },
            {
              code: "SHRINE_FEATURE",
              label: "神社の特徴",
              text: "落ち着いて気持ちを整えやすい雰囲気",
              strength: "mid",
            },
            {
              code: "DISTANCE",
              label: "行きやすさ",
              text: "起点から約123mです。",
              strength: "low",
            },
          ],
        },
      },
      {
        id: "place_abc",
        cardProps: {
          name: "神社B",
          address: "東京都港区",
          recommendReason: "不安・心に向き合う参拝に",
          subReason: "静かに参拝しやすい",
          compatibilityLabels: ["不安・心"],
          distanceM: 456,
          imageUrl: null,
          tags: ["不安・心", "休息"],
          href: undefined,
          isFavorited: false,
          onToggleFavorite: () => {},
        },
      },
      {
        id: "name_%E7%A5%9E%E7%A4%BEC",
        cardProps: {
          name: "神社C",
          address: "東京都渋谷区",
          recommendReason: "金運に向き合う参拝に",
          subReason: "前向きさ・活力を後押ししやすい雰囲気",
          compatibilityLabels: ["金運"],
          distanceM: 789,
          imageUrl: null,
          tags: ["金運"],
          href: undefined,
          isFavorited: true,
          onToggleFavorite: () => {},
        },
      },
    ],
  },
};
