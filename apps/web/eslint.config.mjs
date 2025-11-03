// apps/web/eslint.config.mjs
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";

export default tseslint.config(
  // 無視リスト
  {
    ignores: [
      "node_modules/",
      ".next/",
      "dist/",
      "coverage/",
      "**/*.config.*",
      "**/*.d.ts",
    ],
  },

  // TypeScript (型情報なしで軽く回す)
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        // 型付きLintはオフ（project未設定エラーを避ける）
        // project: undefined
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      next: nextPlugin,
    },
    extends: [
      js.configs.recommended,
      // 型なし推奨セット（strict/type-checked は使わない）
      ...tseslint.configs.recommended,
    ],
    rules: {
      // Next.js のお作法
      "next/no-img-element": "warn",
      "next/no-html-link-for-pages": "off",
      "next/no-img-element": "off",

      // まずは通すために厳しいTypeScriptルールを抑制
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
    },
  },

  // JavaScript
  {
    files: ["**/*.{js,jsx}"],
    extends: [js.configs.recommended],
  },

  // テストファイル向け（vitestプラグイン無しでグローバルを宣言）
  {
    files: ["**/*.{test,spec}.{ts,tsx,js,jsx}"],
    languageOptions: {
      globals: {
        // vitest / jest 互換の代表的グローバル
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        beforeEach: "readonly",
        afterAll: "readonly",
        afterEach: "readonly",
        vi: "readonly",
        jest: "readonly",
      },
    },
  }
);
