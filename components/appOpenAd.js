import { AppOpenAd, TestIds, AdEventType } from 'react-native-google-mobile-ads';
import { AdConfig } from '../utils/AdConfig';

const AD_UNIT_ID = __DEV__ ? TestIds.APP_OPEN : AdConfig.appOpen;

let appOpenAd = null;
let isAdLoaded = false;

export const loadAppOpenAd = (onLoadedCallback = null) => {
  if (appOpenAd) return;

  appOpenAd = AppOpenAd.createForAdRequest(AD_UNIT_ID, {
    requestNonPersonalizedAdsOnly: true,
  });

  appOpenAd.addAdEventListener(AdEventType.LOADED, () => {
    isAdLoaded = true;
    if (onLoadedCallback) onLoadedCallback(); // Notify RootLayout it's ready
  });

  appOpenAd.addAdEventListener(AdEventType.CLOSED, () => {
    appOpenAd = null;
    isAdLoaded = false;
    loadAppOpenAd(); // Load the next one
  });

  appOpenAd.load();
};

export const showAppOpenAd = () => {
  if (isAdLoaded && appOpenAd) {
    appOpenAd.show();
    return true;
  }
  return false;
};

// New helper to check status
export const isAppOpenAdReady = () => isAdLoaded;
