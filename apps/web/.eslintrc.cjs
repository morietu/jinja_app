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
