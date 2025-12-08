// apps/web/vitest.config.ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ["./tsconfig.json"], ignoreConfigErrors: true }), react()],
  esbuild: { jsx: "automatic" },
  test: {
    exclude: [
      "src/features/mypage/components/FavoriteShrineCard.tsx",
      "src/features/mypage/components/FavoritesSection.tsx",
      "src/features/mypage/components/hooks/useFavorites.ts",
    ],
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

        // 低レベルAPI・準備中機能は一旦対象外
        "src/lib/api/http.ts",
        "src/lib/api/mypage.ts",
        "src/features/mypage/components/hooks/useMyGoshuin.ts",

        // 🔽 お気に入り関連を追加で除外
        "src/features/mypage/components/FavoriteShrineCard.tsx",
        "src/features/mypage/components/FavoritesSection.tsx",
        "src/features/mypage/components/hooks/useFavorites.ts",
      ],
    },
  },
});
