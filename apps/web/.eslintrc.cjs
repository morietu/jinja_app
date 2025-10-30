/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["next/core-web-vitals"],
  overrides: [
    {
      files: ["src/**/*.{ts,tsx,js,jsx}"],
      rules: {
        "no-restricted-syntax": [
          "error",
      {
        selector: "CallExpression[callee.object.name='axios'][callee.property.name='create']",
        message: "axios.createは禁止。@/lib/api/client を使ってください。",
      },
    ],
    // ② 直 fetch で /api/ を叩くのを禁止（BFF/Rewrite経由の混入を防ぐ）
    "no-restricted-globals": [
      "error",
      { name: "fetch", message: "fetchで /api を叩かないで。@/lib/api/http を使って。" },
    ],
    // ③ window.axios なども念のため禁止
    "no-restricted-properties": [
      "error",
      {
        object: "window",
        property: "axios",
        message: "window.axiosは禁止。@/lib/api/client を使うこと。",
      },
    ],
  },
          "warn",
          {
            selector: "Literal[value=/^https?:\\/\\//]",
            message:
              "絶対URLを直書きしないでください。サーバーは process.env.API_BASE_SERVER、クライアントは相対パスを使う。",
          },
        ],
      },
    },
  ],
};
