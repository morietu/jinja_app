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
    // まず安定表示が目的なので、href は一旦切る（Link絡みの事故防止）
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
