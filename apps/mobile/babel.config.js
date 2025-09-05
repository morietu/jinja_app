module.exports = function (api) {
  api.cache(true);
  return { presets: ["babel-preset-expo"] }; // ← pluginsは一旦無し
};
