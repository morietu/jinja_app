// apps/web/eslint.config.mjs
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import nextPlugin from "@next/eslint-plugin-next";
import globals from "globals";

const isCI = process.env.CI === "true";

export default [
  // 無視（.eslintignoreの代わり）
  {
    ignores: [
      "node_modules/",
      ".next/",
      "out/",
      "dist/",
      "coverage/",
      "storybook-static/",
      ".storybook-cache/",
      "**/*.config.*",
      "**/*.d.ts",
      ".eslintcache",
    ],
  },

  // 推奨プリセットは配列に“そのまま”挿入
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // プロジェクトのメイン設定
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true }, // ← ここに移動！
      },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
      "@next/next": nextPlugin,
    },
    settings: { react: { version: "detect" } },
    rules: {
      // Next Core Web Vitals 相当
      ...nextPlugin.configs["core-web-vitals"].rules,

      // React 17+ は import React 不要
      "react/react-in-jsx-scope": "off",

      // Hooks
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // 未使用変数は TS 側で。先頭 _ は許容
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // うるさめ緩和
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/restrict-template-expressions": "off",

      // Next お好み
      "@next/next/no-html-link-for-pages": "off",
      ...(isCI
        ? { "@next/next/no-img-element": "off" }
        : { "@next/next/no-img-element": "warn" }),
    },
  },

  // テストのグローバル
  {
    files: ["**/*.{test,spec}.{ts,tsx,js,jsx}"],
    languageOptions: { globals: { ...globals.jest } },
  },

  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
