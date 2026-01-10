// eslint.config.mjs (repo root)
import webConfig from "./apps/web/eslint.config.mjs";

export default [
  ...webConfig,
  {
    ignores: ["apps/**/.next/**", "apps/**/dist/**", "apps/**/out/**", "**/node_modules/**"],
  },
];
