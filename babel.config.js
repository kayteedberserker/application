module.exports = function (api) {
  api.cache(true);
  const isProd = process.env.NODE_ENV === 'production';

  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      "react-native-reanimated/plugin",
      // ⚡️ Only strip consoles in production
      isProd && ["transform-remove-console", { exclude: ["error", "warn"] }],
    ].filter(Boolean),
  };
};