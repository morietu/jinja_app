// apps/web/vitest.config.ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ["./tsconfig.json"], ignoreConfigErrors: true }), react()],
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    environmentOptions: { jsdom: { url: "http://localhost/" } },
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/tests/*.{ts,tsx}", "src/**/__tests__/**/*.{test,spec}.{js,ts,tsx}"],
    globals: true,
    css: false,
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "html", "lcov"],
      thresholds: {
        lines: 80,
        statements: 80,
        branches: 70,
        functions: 80,
      },
      exclude: [
        "node_modules/**",
        ".next/**",
        "**/*.d.ts",
        "vitest.config.ts",
        "vitest.setup.ts",
        "storybook-static/**",
      ],
    },
  },
});
