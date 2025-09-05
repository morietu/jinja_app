/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#E24E33", // 朱
        accent:  "#F2C94C", // 金
        paper:   "#F6F3EE", // 和紙
      },
      borderRadius: { xl: "16px" },
    },
  },
  plugins: [],
};
