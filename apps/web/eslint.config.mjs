// 先頭はそのまま
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";
// import next from "eslint-config-next"; // ← 未使用なら削除
import reactHooks from "eslint-plugin-react-hooks";

const isCI = process.env.CI === "true";

export default tseslint.config(
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

  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "react-hooks": reactHooks, // ← 追加
    },
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      nextPlugin.configs.recommended, // Next 推奨
      // nextPlugin.configs["core-web-vitals"], // 必要なら
    ],
    rules: {
      // React Hooks ルールを有効化（これが無いと “rule not found”）
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // お好みの調整
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
      "@next/next/no-html-link-for-pages": "off",
      ...(isCI
        ? { "@next/next/no-img-element": "off" }
        : { "@next/next/no-img-element": "warn" }),
    },
  },

  { files: ["**/*.{js,jsx}"], extends: [js.configs.recommended] },

  {
    files: ["**/*.{test,spec}.{ts,tsx,js,jsx}"],
    languageOptions: {
      globals: {
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
