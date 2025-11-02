// apps/web/vitest.config.ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    // 余計な tsconfig を拾わないようにプロジェクトを限定
    tsconfigPaths({
      projects: ["./tsconfig.json"],
      ignoreConfigErrors: true, // 変な tsconfig があっても握りつぶす
    }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/tests/*.{ts,tsx}"],
    globals: true,
    css: false,
  },
});
