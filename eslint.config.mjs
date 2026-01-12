// eslint.config.mjs (repo root)
import webConfig from "./apps/web/eslint.config.mjs";

export default [
  // ✅ まず全体を止める（ここが先頭）
  {
    ignores: [
      "**/.venv/**",
      "**/staticfiles/**",
      "**/node_modules/**",
      "**/.next/**",
      "**/coverage/**",
      "**/storybook-static/**",
      "backend/**",
      "apps/mobile/**",
    ],
  },

  // ✅ web だけ lint したいなら、webConfig を後ろに
  ...webConfig,
];
