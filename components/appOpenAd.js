import {
    AdEventType,
    AppOpenAd,
    TestIds,
} from 'react-native-google-mobile-ads';
import { AdConfig } from '../utils/AdConfig';

let appOpenAd = null;
let isLoaded = false;
let isShowing = false;

// 🔹 Use Test ID in development to prevent account flags
const AD_UNIT_ID = __DEV__ ? TestIds.APP_OPEN : AdConfig.appOpen;

export const loadAppOpenAd = () => {
    // Prevent duplicate requests
    if (appOpenAd || isShowing) return;

    console.log("AD_ENGINE: Requesting App Open Ad...");
    
    // Create the instance
    appOpenAd = AppOpenAd.createForAdRequest(AD_UNIT_ID, {
        requestNonPersonalizedAdsOnly: true,
    });

    // 1. Success Listener
    appOpenAd.addAdEventListener(AdEventType.LOADED, () => {
        isLoaded = true;
        console.log("AD_ENGINE: App Open Loaded Successfully");
    });

    // 2. Failure Listener (Critical for dashboard tracking)
    appOpenAd.addAdEventListener(AdEventType.ERROR, (error) => {
        console.error("AD_ENGINE: App Open Load Error: ", error);
        isLoaded = false;
        appOpenAd = null;
        
        // Retry loading after 30 seconds if it fails
        setTimeout(() => {
            loadAppOpenAd();
        }, 30000);
    });

    // 3. Close Listener
    appOpenAd.addAdEventListener(AdEventType.CLOSED, () => {
        isLoaded = false;
        isShowing = false;
        appOpenAd = null;
        console.log("AD_ENGINE: App Open Closed - Re-loading for next session");
        loadAppOpenAd(); // Preload next immediately
    });

    // Start the load
    appOpenAd.load();
};

export const showAppOpenAd = () => {
    if (isLoaded && appOpenAd && !isShowing) {
        isShowing = true;
        console.log("AD_ENGINE: Executing App Open Show");
        appOpenAd.show();
    } else {
        console.log("AD_ENGINE: Show skipped. Loaded:", isLoaded, "Showing:", isShowing);
        // If it's not loaded, try to trigger a load
        if (!appOpenAd) loadAppOpenAd();
    }
};
