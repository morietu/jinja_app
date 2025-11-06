import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "Sample/Button",
  render: (args) => (
    <button className="px-3 py-1 rounded bg-emerald-600 text-white" {...args}>
      {args.label}
    </button>
  ),
  args: { label: "Hello" },
} satisfies Meta<any>;

export default meta;
export type Story = StoryObj<typeof meta>;
export const Default: Story = {};
