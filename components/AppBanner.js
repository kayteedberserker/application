import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
// 🔹 LevelPlay SDK 8.4.0+ imports
import { LevelPlayAdSize, LevelPlayBannerAdView } from 'unity-levelplay-mediation';
import { AdConfig } from '../utils/AdConfig';

const BANNER_ID = AdConfig.banner || "97tambjxr88508m5";

/**
 * @param {string} size - Prop to determine ad size: 'BANNER', 'LARGE', or 'MREC'
 */
const AppBanner = ({ size = 'MREC' }) => {
  const [loaded, setLoaded] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  
  const bannerAdViewRef = useRef(null);
  const isInitialLoadTriggered = useRef(false); // 🚩 Prevents double loading
  const retryTimer = useRef(null);

  // 🛠️ Stable layout calculation
  const layout = useMemo(() => {
    const s = size.toUpperCase();
    if (s === 'BANNER') return { sdkSize: LevelPlayAdSize.BANNER, width: 320, height: 50 };
    if (s === 'LARGE') return { sdkSize: LevelPlayAdSize.LARGE, width: 320, height: 90 };
    return { sdkSize: LevelPlayAdSize.MEDIUM_RECTANGLE, width: 300, height: 250 };
  }, [size]);

  const loadAdInternal = useCallback(() => {
    if (bannerAdViewRef.current) {
      bannerAdViewRef.current.loadAd();
    }
  }, [size]);

  // 🛠️ Stable listener object
  const adListener = useMemo(() => ({
    onAdLoaded: (adInfo) => {
      // console.log(`✅ Banner [${size}] Loaded:`);
      setLoaded(true);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    onAdLoadFailed: (error) => {
      console.warn(`LevelPlay Banner [${size}] Load Failed:`, error.message);
      setLoaded(false);
      
      // Only retry manually if the SDK's auto-refresh isn't handling it
      // Standard interval for failure retry is usually 30-60s
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => {
        loadAdInternal();
      }, 30000); 
    },
    onAdClicked: (adInfo) => console.log("Banner Clicked", adInfo),
    onAdDisplayed: (adInfo) => {
      console.log("Banner Displayed (Impression)");
      // Logic for "Reload 5s after view" is usually handled by Dashboard auto-refresh.
      // If you MUST do it manually (not recommended), you would call loadAdInternal() here 
      // after a 5000ms delay. But LevelPlay prefers dashboard-managed refresh.
    },
    onAdDisplayFailed: (adInfo, error) => console.log("Banner Display Failed", error),
    onAdExpanded: (adInfo) => console.log("Banner Expanded", adInfo),
    onAdCollapsed: (adInfo) => console.log("Banner Collapsed", adInfo),
    onAdLeftApplication: (adInfo) => console.log("Left App", adInfo),
  }), [size, loadAdInternal]);

  useEffect(() => {
    // 1. Set component as ready to render
    const timer = setTimeout(() => setShouldRender(true), 1000);
    
    return () => {
      clearTimeout(timer);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (bannerAdViewRef.current) {
        bannerAdViewRef.current.destroy(); // 🧹 Essential to prevent memory leaks
      }
    };
  }, []);

  if (Platform.OS === 'web') return null;

  return (
    <View 
      style={{  
        width: '100%', 
        alignItems: 'center', 
        justifyContent: 'center',
        marginVertical: 15,
        height: layout.height,
        backgroundColor: 'transparent',
      }}
    >
      {/* 🔹 LOADING ANIMATION */}
      {!loaded && (
        <View style={{ 
          position: 'absolute', 
          height: layout.height, 
          width: layout.width, 
          justifyContent: 'center', 
          alignItems: 'center',
          backgroundColor: 'rgba(59, 130, 246, 0.05)',
          borderRadius: size === 'MREC' ? 12 : 0,
          borderWidth: 1,
          borderColor: 'rgba(59, 130, 246, 0.1)',
          zIndex: 1
        }}>
          <ActivityIndicator size="small" color="#3b82f6" />
          {layout.height > 60 && (
            <Text style={{ fontSize: 10, color: '#3b82f6', marginTop: 10, fontWeight: '600' }}>
              LOADING AD...
            </Text>
          )}
        </View>
      )}

      {/* 🔹 AD VIEW CONTAINER */}
      <View style={{ width: layout.width, height: layout.height, opacity: loaded ? 1 : 0 }}>
        {shouldRender && (
          <LevelPlayBannerAdView
            key={`banner_view_${size}`} 
            ref={bannerAdViewRef}
            adUnitId={BANNER_ID}
            adSize={layout.sdkSize}
            placementName={size === 'MREC' ? 'DefaultMREC' : 'DefaultBanner'} 
            listener={adListener}
            onLayout={() => {
              // 🚩 Only trigger load once per component mount
              if (!isInitialLoadTriggered.current && bannerAdViewRef.current) {
                isInitialLoadTriggered.current = true;
                loadAdInternal();
              }
            }}
            style={{ width: layout.width, height: layout.height }}
          />
        )}
      </View>
    </View>
  );
};

export default AppBanner;