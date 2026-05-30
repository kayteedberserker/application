module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      ['babel-plugin-react-compiler', { target: '19' }], // ◄ Always first!
      "react-native-reanimated/plugin", // MUST be after nativewind
    ],
  };
};