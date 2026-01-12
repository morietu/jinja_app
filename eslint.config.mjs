// eslint.config.mjs (repo root)
import webConfig from "./apps/web/eslint.config.mjs";

export default [
  ...webConfig,
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.venv/**",
      "**/staticfiles/**",

      "backend/**",
      "apps/mobile/**",

      "apps/web/coverage/**",
      "apps/web/storybook-static/**",
    ],
  },
];
