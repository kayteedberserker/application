const { withAndroidManifest, withAppBuildGradle, withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withAdMediation(config) {
  
  // 1. Inject ironSource & Unity Activities with MERGE CONFLICT FIX
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const mainApplication = manifest.application[0];
    
    // Add the "tools" namespace to the root <manifest> tag
    if (!manifest['$']['xmlns:tools']) {
      manifest['$']['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    const activities = [
      { 'android:name': 'com.ironsource.sdk.controller.ControllerActivity', 'android:configChanges': 'orientation|screenSize', 'android:hardwareAccelerated': 'true' },
      { 
        'android:name': 'com.ironsource.sdk.controller.InterstitialActivity', 
        'android:configChanges': 'orientation|screenSize', 
        'android:hardwareAccelerated': 'true', 
        'android:theme': '@android:style/Theme.Translucent',
        'tools:replace': 'android:theme' // 🛠️ THIS FIXES THE MERGE ERROR
      },
      { 'android:name': 'com.ironsource.sdk.controller.OpenVideoActivity', 'android:configChanges': 'orientation|screenSize', 'android:hardwareAccelerated': 'true', 'android:theme': '@android:style/Theme.Translucent' },
      { 'android:name': 'com.unity3d.services.ads.adunit.AdUnitActivity', 'android:configChanges': 'fontScale|keyboard|keyboardHidden|locale|mnc|mcc|navigation|orientation|screenLayout|screenSize|smallestScreenSize|uiMode|touchscreen', 'android:hardwareAccelerated': 'true', 'android:theme': '@android:style/Theme.NoTitleBar.Fullscreen', 'android:exported': 'false' }
    ];

    activities.forEach(activity => {
      const existingActivity = mainApplication.activity.find(a => a['$'] && a['$']['android:name'] === activity['android:name']);
      if (!existingActivity) {
        mainApplication.activity.push({ '$': activity });
      } else {
        // If it exists, update it with our tools:replace to be safe
        Object.assign(existingActivity['$'], activity);
      }
    });

    return config;
  });

  // 2. Inject Native Dependencies into app/build.gradle
  config = withAppBuildGradle(config, (config) => {
    const dependencies = `
    implementation 'com.google.android.gms:play-services-ads:24.9.0'
    implementation 'com.google.ads.mediation:unity:4.16.6.0'
    implementation 'com.unity3d.ads:unity-ads:4.16.5'
    implementation 'com.google.ads.mediation:ironsource:9.3.0.0'
    implementation 'com.unity3d.ads-mediation:mediation-sdk:9.3.0'
    
    constraints {
        implementation('androidx.work:work-runtime:2.9.0') {
            because 'Conflict between AdMob and Reanimated Worklets'
        }
    }
    `;

    if (!config.modResults.contents.includes('com.google.ads.mediation:unity')) {
      config.modResults.contents = config.modResults.contents.replace(
        /dependencies\s?{/,
        `dependencies {${dependencies}`
      );
    }
    return config;
  });

  // 3. Add Maven Repos
  config = withProjectBuildGradle(config, (config) => {
    const ironSourceRepo = `maven { url "https://android-sdk.is.com/" }`;
    if (!config.modResults.contents.includes('https://android-sdk.is.com/')) {
      config.modResults.contents = config.modResults.contents.replace(
        /allprojects\s?{\s?repositories\s?{/,
        `allprojects {\n    repositories {\n        ${ironSourceRepo}`
      );
    }
    return config;
  });

  return config;
};