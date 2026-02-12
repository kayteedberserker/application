const {
  withAndroidManifest,
  withAppBuildGradle,
  withProjectBuildGradle,
} = require("@expo/config-plugins");

module.exports = function withAdMediation(config) {

  /* ---------------- 1. Manifest Configuration ---------------- */
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const mainApplication = manifest.application[0];

    if (!manifest["$"]["xmlns:tools"]) {
      manifest["$"]["xmlns:tools"] = "http://schemas.android.com/tools";
    }

    const activities = [
      // ironSource / LevelPlay Core
      {
        "android:name": "com.ironsource.sdk.controller.ControllerActivity",
        "android:configChanges": "orientation|screenSize",
        "android:hardwareAccelerated": "true",
      },
      {
        "android:name": "com.ironsource.sdk.controller.InterstitialActivity",
        "android:configChanges": "orientation|screenSize",
        "android:hardwareAccelerated": "true",
        "android:theme": "@android:style/Theme.Translucent",
        "tools:replace": "android:theme",
      },
      // Unity Ads
      {
        "android:name": "com.unity3d.services.ads.adunit.AdUnitActivity",
        "android:configChanges": "fontScale|keyboard|keyboardHidden|locale|mnc|mcc|navigation|orientation|screenLayout|screenSize|smallestScreenSize|uiMode|touchscreen",
        "android:theme": "@android:style/Theme.NoTitleBar.Fullscreen",
        "tools:replace": "android:theme",
      }
    ];

    mainApplication.activity = mainApplication.activity || [];

    activities.forEach((activity) => {
      const exists = mainApplication.activity.find(
        (a) => a["$"] && a["$"]["android:name"] === activity["android:name"]
      );
      if (!exists) mainApplication.activity.push({ $: activity });
    });

    return config;
  });

  /* ---------------- 2. Implementation of Stable Adapters ---------------- */
  config = withAppBuildGradle(config, (config) => {
    const dependencies = `
    // Unity LevelPlay Core
    implementation 'com.unity3d.ads-mediation:mediation-sdk:8.9.1'

    // Start.io (StartApp) Mediation Adapter
    implementation 'io.start:unity-ads-mediation:3.0.0'
    // Start.io SDK is pulled automatically by the adapter, but explicitly defined:
    implementation 'com.startapp:inapp-sdk:5.1.0'

    // Google AdMob
    implementation 'com.unity3d.ads-mediation:admob-adapter:4.3.43'
    implementation 'com.google.android.gms:play-services-ads:24.9.0'

    // Unity Ads
    implementation 'com.unity3d.ads-mediation:unityads-adapter:5.5.0'
    implementation 'com.unity3d.ads:unity-ads:4.16.6'

    // Liftoff/Vungle
    implementation 'com.unity3d.ads-mediation:vungle-adapter:5.5.0'
    implementation 'com.vungle:vungle-ads:7.7.0'

    implementation 'com.squareup.picasso:picasso:2.8'

    constraints {
        implementation('androidx.work:work-runtime:2.9.0') {
            because 'Conflict prevention'
        }
    }
    `;

    // Only add if not already present
    if (!config.modResults.contents.includes("io.start:unity-ads-mediation")) {
      config.modResults.contents = config.modResults.contents.replace(
        /dependencies\s?{/,
        `dependencies {${dependencies}`
      );
    }

    return config;
  });

  /* ---------------- 3. Clean Repositories Block ---------------- */
  config = withProjectBuildGradle(config, (config) => {
    // Added Start.io Maven Repository
    if (!config.modResults.contents.includes("maven-repo.start.io")) {
      config.modResults.contents = config.modResults.contents.replace(
        /dependencyResolutionManagement\s?{\s?repositories\s?{/,
        `dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven { url "https://maven-repo.start.io/" }
        maven { url "https://jitpack.io" }`
      );
    }
    return config;
  });

  return config;
};