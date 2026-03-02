const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withPurchases(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Ensure permissions array exists
    if (!manifest["uses-permission"]) {
      manifest["uses-permission"] = [];
    }

    // Add Billing permission if it doesn't exist
    const hasBilling = manifest["uses-permission"].some(
      (p) => p["$"]["android:name"] === "com.android.vending.BILLING"
    );

    if (!hasBilling) {
      manifest["uses-permission"].push({
        $: { "android:name": "com.android.vending.BILLING" },
      })
    }

    return config;
  });
};