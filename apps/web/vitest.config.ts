// apps/web/vitest.config.ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ["./tsconfig.json"], ignoreConfigErrors: true })],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/tests/*.{ts,tsx}"],
    globals: true,
    css: false,
    coverage: {
      provider: "v8",
      thresholds: { lines: 90, statements: 85, branches: 75, functions: 80 },                // ← これで @vitest/coverage-v8 を使う
      reportsDirectory: "./coverage",
      reporter: ["text", "html", "lcov"],
      exclude: [
        "node_modules/**",
        ".next/**",
        "**/*.d.ts",
        "vitest.config.ts",
        "vitest.setup.ts",
      ],
    },
  },
});
