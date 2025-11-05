import type { Preview } from "@storybook/react";
import "../src/app/globals.css"; // ← プロジェクトに合わせて必要なら変更

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: { expanded: true },
    a11y: { disable: false },
  },
};
export default preview;
