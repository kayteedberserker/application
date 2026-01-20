import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { AdConfig } from '../utils/AdConfig';

const BANNER_ID = __DEV__ ? TestIds.BANNER : AdConfig.banner;

const AppBanner = ({ size = BannerAdSize.MEDIUM_RECTANGLE }) => {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [retryKey, setRetryKey] = useState(0); // Used to force a reload
  const retryTimer = useRef(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  const getMinHeight = () => {
    if (size === BannerAdSize.MEDIUM_RECTANGLE) return 250;
    return 50; 
  };

  const handleAdFailed = (error) => {
    if (__DEV__) console.error("Banner Ad failed:", error);
    setLoaded(false);
    
    // Instead of hiding forever, we try again in 60 seconds
    // This helps if the "No Fill" was just temporary
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => {
      setFailed(false);
      setRetryKey(prev => prev + 1); // Incrementing key forces the BannerAd to remount
    }, 15000); 

    // Optional: setFailed(true) if you want to hide it until the next retry
    // For now, we keep the space reserved to prevent UI jumping
  };
  
  return (
    
    <View 
      style={{  
        width: '100%', 
        alignItems: 'center', 
        justifyContent: 'center',
        marginVertical: 10,
        backgroundColor: loaded ? 'transparent' : 'rgba(0,0,0,0.02)', // Subtle hint of space
        borderRadius: 10,
        overflow: 'hidden'
      }}
    >
      {/* 🔹 LOADING ANIMATION: Shows while ad is fetching */}
{/* {!loaded && !failed && (
       <View style={{ position: 'absolute' }}>
          <ActivityIndicator size="small" color="#3b82f6" />
        </View>
      )}

     <BannerAd
       key={retryKey} // 🔹 Forces re-render on retry
       unitId={BANNER_ID}
       size={size}
       requestOptions={{
         requestNonPersonalizedAdsOnly: true,
        }}
        onAdLoaded={() => {
          setLoaded(true);
          setFailed(false);
          if (retryTimer.current) clearTimeout(retryTimer.current);
          if (__DEV__) console.log(`Banner Loaded: ${size}`);
        }}
        onAdFailedToLoad={(error) => {
          handleAdFailed(error);
       }}
      />*/}
    </View>
  );
};

export default AppBanner;
