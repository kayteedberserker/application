// import { AdEventType, AppOpenAd } from 'react-native-google-mobile-ads';
import { AdConfig } from '../utils/AdConfig';

const AD_UNIT_ID = AdConfig.appOpen;

let appOpenAd = null;
let isAdLoaded = false;
let isShowingAd = false; // Prevent multiple ads showing at once

export const loadAppOpenAd = (onLoadedCallback = null) => {
  // If already loaded, trigger callback immediately
  if (isAdLoaded && onLoadedCallback) {
    onLoadedCallback();
    return;
  }
  
  if (appOpenAd) return;

  appOpenAd = AppOpenAd.createForAdRequest(AD_UNIT_ID, {
    requestNonPersonalizedAdsOnly: true,
  });

  appOpenAd.addAdEventListener(AdEventType.LOADED, () => {
    isAdLoaded = true;
    if (__DEV__) console.log("App Open Ad Loaded");
    if (onLoadedCallback) onLoadedCallback(); // Notify RootLayout it's ready
  });

  appOpenAd.addAdEventListener(AdEventType.CLOSED, () => {
    appOpenAd = null;
    isAdLoaded = false;
    isShowingAd = false;
    if (__DEV__) console.log("App Open Ad Closed");
    loadAppOpenAd(); // Load the next one immediately
  });

  appOpenAd.addAdEventListener(AdEventType.ERROR, (error) => {
    appOpenAd = null;
    isAdLoaded = false;
    isShowingAd = false;
    // Retry loading after 30 seconds if it fails (e.g. No Fill)
    setTimeout(() => loadAppOpenAd(), 30000);
  });

  appOpenAd.load();
};

export const showAppOpenAd = () => {
  // Don't try to show if one is already visible or not loaded
  if (isAdLoaded && appOpenAd && !isShowingAd) {
    isShowingAd = true;
    appOpenAd.show();
    return true;
  }
  return false;
};

// New helper to check status
export const isAppOpenAdReady = () => isAdLoaded;
