import type { Meta, StoryObj } from "@storybook/react";
import { ShrineCard } from "./ShrineCard";

const meta = {
  title: "Shrines/ShrineCard",
  component: ShrineCard,
  argTypes: {
    onToggleFavorite: { action: "toggleFavorite" },
  },
  args: {
    name: "浅草神社",
    address: "東京都台東区浅草2-3-1",
    distanceM: 420,
    rating: 4.5,
    reviewCount: 1234,
    imageUrl: "https://placehold.co/320x240",
    tags: ["縁結び", "金運", "厄除け"],
    href: undefined,
    isFavorited: false,
  },
} satisfies Meta<typeof ShrineCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoImage: Story = { args: { imageUrl: null } };

export const LongName: Story = {
  args: {
    name: "めちゃくちゃ長い神社名".repeat(8),
  },
};

export const LongAddress: Story = {
  args: {
    address: "東京都台東区浅草2-3-1 ".repeat(8),
  },
};

export const Favorited: Story = { args: { isFavorited: true } };

export const TopPick: Story = {
  args: {
    name: "神社A",
    address: "東京都千代田区",
    recommendReason: "転機・仕事に向き合う参拝に",
    subReason: "落ち着いて気持ちを整えやすい雰囲気",
    compatibilityLabels: ["転機・仕事", "休息"],
    distanceM: 123,
    imageUrl: "https://placehold.co/320x240",
    tags: ["転機・仕事", "休息"],
    isTopPick: true,
    isFavorited: false,
  },
};

export const WithExplanation: Story = {
  args: {
    name: "神社A",
    address: "東京都千代田区",
    recommendReason: "不安・心に向き合う参拝に",
    subReason: "落ち着いて気持ちを整えやすい雰囲気",
    compatibilityLabels: ["不安・心", "休息"],
    distanceM: 320,
    imageUrl: "https://placehold.co/320x240",
    tags: ["不安・心", "休息"],
    explanationSummary: "不安・心に向き合う参拝に",
    explanationReasons: [
      {
        code: "NEED_MATCH",
        label: "相談との一致",
        text: "不安・心に関する相談内容との一致が見られます。",
        strength: "high",
      },
      {
        code: "SHRINE_FEATURE",
        label: "神社の特徴",
        text: "落ち着いて気持ちを整えやすい雰囲気",
        strength: "mid",
      },
      {
        code: "REASON_SOURCE",
        label: "主理由の生成元",
        text: "悩みとの一致",
        strength: "mid",
      },
    ],
  },
};
