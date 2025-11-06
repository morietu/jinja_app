import type { StorybookConfig } from "@storybook/nextjs";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(ts|tsx)"],
  // addon-toolbars は不要。a11y と docs だけにする
  addons: ["@storybook/addon-a11y", "@storybook/addon-docs"],
  framework: { name: "@storybook/nextjs", options: {} },
  typescript: { reactDocgen: "react-docgen-typescript" },
  webpackFinal: async (cfg) => {
    cfg.performance = { hints: false };
    return cfg;
  },
};
export default config;
