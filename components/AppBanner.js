import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
// 🔹 LevelPlay SDK 8.4.0+ imports
import { LevelPlayAdSize, LevelPlayBannerAdView } from 'unity-levelplay-mediation';
import { AdConfig } from '../utils/AdConfig';

const BANNER_ID = String(AdConfig.banner || "8087965f97374668").trim();

/**
 * @param {string} size - Prop to determine ad size: 'BANNER', 'LARGE', or 'MREC'
 */
const AppBanner = ({ size = 'MREC' }) => {
  const [loaded, setLoaded] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  
  const bannerAdViewRef = useRef(null);
  const retryTimer = useRef(null);

  // 🛠️ Stable layout calculation
  const layout = useMemo(() => {
    const s = size.toUpperCase();
    if (s === 'BANNER') return { sdkSize: LevelPlayAdSize.BANNER, width: 320, height: 50 };
    if (s === 'LARGE') return { sdkSize: LevelPlayAdSize.LARGE, width: 320, height: 90 };
    return { sdkSize: LevelPlayAdSize.MEDIUM_RECTANGLE, width: 300, height: 250 };
  }, [size]);

  const loadAdInternal = useCallback(() => {
    // Check if component is still mounted and ref exists
    if (bannerAdViewRef.current) {
      console.log(`📡 [${size}] Background load attempt...`);
      bannerAdViewRef.current.loadAd();
    }
  }, [size]);

  // 🛠️ Stable listener object to prevent re-render loops and bridge crashes
  const adListener = useMemo(() => ({
    onAdLoaded: (adInfo) => {
      console.log(`✅ Banner [${size}] successfully filled:`, adInfo.adNetwork);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      setLoaded(true);
    },
    onAdLoadFailed: (error) => {
      console.warn(`LevelPlay Banner [${size}] Load Failed (Retrying in 30s):`, error);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => {
        loadAdInternal();
      }, 30000); 
    },
    onAdClicked: () => console.log("Banner Clicked"),
    onAdDisplayed: () => console.log("Banner Displayed"),
    onAdDisplayFailed: (_, error) => console.log("Banner Display Failed", error),
  }), [size, loadAdInternal]);

  useEffect(() => {
    // Delay mount to ensure native bridge is initialized
    const timer = setTimeout(() => setShouldRender(true), 1000);
    
    return () => {
      clearTimeout(timer);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (bannerAdViewRef.current) {
        bannerAdViewRef.current.destroy();
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
          {layout.height > 100 && (
            <Text style={{ fontSize: 10, color: '#3b82f6', marginTop: 10, fontWeight: '600' }}>
              LOADING_AD_CONTENT
            </Text>
          )}
        </View>
      )}

      {/* 🔹 AD VIEW CONTAINER */}
      <View style={{ width: layout.width, height: layout.height, opacity: loaded ? 1 : 0 }}>
        {shouldRender && (
          <LevelPlayBannerAdView
            key={`banner_${size}`} // Force re-mount if size changes to prevent stale native views
            ref={bannerAdViewRef}
            adUnitId={BANNER_ID}
            adSize={layout.sdkSize}
            placementName={`Placement_${size}`} 
            listener={adListener}
            onLayout={() => {
              // Ensure bridge is ready
              if (bannerAdViewRef.current) {
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