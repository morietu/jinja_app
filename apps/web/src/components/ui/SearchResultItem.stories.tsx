// src/components/ui/SearchResultItem.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { SearchResultItem } from "./SearchResultItem";

const meta = {
  title: "Search/SearchResultItem",
  component: SearchResultItem,
} satisfies Meta<typeof SearchResultItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "浅草神社",
    subtitle: "東京都台東区",
  },
};
