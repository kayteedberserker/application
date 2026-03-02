const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// 🔹 SKIA RESOLUTION FIX
// This tells Metro to look for the specific extensions Skia uses
config.resolver.sourceExts.push('mjs'); 

module.exports = withNativeWind(config, { input: './app/globals.css' });