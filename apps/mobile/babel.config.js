module.exports = function (api) {
  api.cache(true);
   return {
    presets: [
      // 旧 reanimated/plugin の自動注入を無効化（Expoの自動設定対策）
      ["babel-preset-expo", { reanimated: false }]
    ],
    // Reanimated v4 以降は worklets/plugin を使う
    plugins: ["react-native-worklets/plugin"],
  };
};
