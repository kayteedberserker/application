

const IS_PRODUCTION = true;

export const AdConfig = {
  // Use the ID: 97tambjxr88508m5
  banner: IS_PRODUCTION
    ? '97tambjxr88508m5' 
    : '97tambjxr88508m5', // LevelPlay uses the same ID for test mode usually

  // Use the ID: 34wz6l0uzrpi6ce0
  interstitial: IS_PRODUCTION
    ? '34wz6l0uzrpi6ce0'
    : '34wz6l0uzrpi6ce0',

  // Use the ID: 08uwc66m8rmsirsy
  native: IS_PRODUCTION
    ? '08uwc66m8rmsirsy'
    : '08uwc66m8rmsirsy',

  // Use the ID: pw746blifv59mqoq
  rewarded: IS_PRODUCTION
    ? 'pw746blifv59mqoq'
    : 'pw746blifv59mqoq',

  // If you haven't created an App Open ad unit in LevelPlay, 
  // this will fail if you use the old Google ca-app-pub ID.
  appOpen: IS_PRODUCTION
    ? 'YOUR_LEVELPLAY_APP_OPEN_ID' 
    : 'YOUR_LEVELPLAY_APP_OPEN_ID',
};