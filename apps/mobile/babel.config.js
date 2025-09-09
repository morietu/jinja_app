module.exports = function (api) {
  api.cache(true);
  // デバッグ用に、読まれていることをログ出し（起動時に一度出ます）
  console.log("[BABEL] using root babel.config.js");
   return {
    presets: [
      // 旧 reanimated/plugin の自動注入を無効化（Expoの自動設定対策）
      ["babel-preset-expo", { reanimated: false }]
    ],
    // Reanimated v4 以降は worklets/plugin を使う
    plugins: ["react-native-worklets/plugin"],
  };
};
