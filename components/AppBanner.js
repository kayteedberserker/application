import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { AdConfig } from '../utils/AdConfig';

const BANNER_ID = AdConfig.banner;

const AppBanner = ({ size = BannerAdSize.MEDIUM_RECTANGLE }) => {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [retryKey, setRetryKey] = useState(0); 
  const retryTimer = useRef(null);

  // Determine fixed height based on size to prevent layout jumping/flicking
  const adDimensions = useMemo(() => {
    switch (size) {
      case BannerAdSize.MEDIUM_RECTANGLE:
        return { height: 250, width: 300 };
      case BannerAdSize.FULL_BANNER:
        return { height: 60, width: '100%' };
      case BannerAdSize.BANNER:
        return { height: 50, width: '100%' };
      default:
        return { height: 50, width: '100%' };
    }
  }, [size]);

  useEffect(() => {
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  const handleAdFailed = (error) => {
    if (__DEV__) console.error("Banner Ad failed:", error);
    setLoaded(false);
    
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => {
      setFailed(false);
      setRetryKey(prev => prev + 1);
    }, 15000); 
  };
  
  return (
    <View 
      style={{  
        width: '100%', 
        alignItems: 'center', 
        justifyContent: 'center',
        marginVertical: 10,
        // CRITICAL: Set fixed height before loading to stop flickering
        height: adDimensions.height,
        backgroundColor: 'transparent',
        borderRadius: 10,
        overflow: 'hidden'
      }}
    >
      {/* 🔹 LOADING ANIMATION: Centered inside the reserved space */}
      {!loaded && !failed && (
        <View style={{ 
          position: 'absolute', 
          height: adDimensions.height, 
          width: '100%', 
          justifyContent: 'center', 
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.03)',
          borderRadius: 10
        }}>
          <ActivityIndicator size="small" color="#3b82f6" />
        </View>
      )}

      <BannerAd
        key={retryKey} 
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
      />
    </View>
  );
};

export default AppBanner;