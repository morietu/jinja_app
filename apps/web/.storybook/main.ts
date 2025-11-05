// apps/web/.storybook/main.ts
import type { StorybookConfig } from "@storybook/nextjs";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y"],
  framework: { name: "@storybook/nextjs", options: {} },
  typescript: { reactDocgen: "react-docgen-typescript" },
  webpackFinal: async (cfg) => {
    cfg.performance = { hints: false }; // ← サイズ警告を抑制
    return cfg;
  },
};
export default config;
