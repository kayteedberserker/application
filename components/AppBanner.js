import React, { useState } from 'react';
import { View } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { AdConfig } from '../utils/AdConfig';

// 🔹 Use Test ID in dev to avoid "No Fill" or account flags
const BANNER_ID = __DEV__ ? TestIds.BANNER : AdConfig.banner;

const AppBanner = ({ size = BannerAdSize.MEDIUM_RECTANGLE }) => {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Define heights based on size to prevent layout jumping
  const getMinHeight = () => {
    if (size === BannerAdSize.MEDIUM_RECTANGLE) return 250;
    if (size === BannerAdSize.ANCHORED_ADAPTIVE_BANNER) return 50;
    return 50;
  };

  // If the ad fails, we hide the container entirely to keep the UI clean
  if (failed) return null;

  return (
    <View 
      style={{ 
        minHeight: loaded ? 0 : getMinHeight(), 
        width: '100%', 
        alignItems: 'center', 
        justifyContent: 'center',
        marginVertical: loaded ? 10 : 0 
      }}
    >
      <BannerAd
        unitId={BANNER_ID}
        size={size}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true, // Generally safer for fill rates
        }}
        onAdLoaded={() => {
          setLoaded(true);
          if (__DEV__) console.log(`Banner Loaded: ${size}`);
        }}
        onAdFailedToLoad={(error) => {
          setFailed(true);
          if (__DEV__) console.error("Banner Ad failed:", error);
        }}
      />
    </View>
  );
};

export default AppBanner;
