import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Text,
  View
} from 'react-native';
import { LevelPlayAdSize, LevelPlayBannerAdView } from 'unity-levelplay-mediation';
import { AdConfig } from '../utils/AdConfig';

const BANNER_ID = AdConfig.banner || "97tambjxr88508m5";

const AppBanner = ({ size = 'MREC' }) => {
  const [loaded, setLoaded] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  const bannerAdViewRef = useRef(null);
  const isInitialLoadTriggered = useRef(false);
  const retryTimer = useRef(null);

  const layout = useMemo(() => {
    const s = size.toUpperCase();
    if (s === 'BANNER') return { sdkSize: LevelPlayAdSize.BANNER, width: 320, height: 50 };
    if (s === 'LARGE') return { sdkSize: LevelPlayAdSize.LARGE, width: 320, height: 90 };
    return { sdkSize: LevelPlayAdSize.MEDIUM_RECTANGLE, width: 300, height: 250 };
  }, [size]);

  const loadAdInternal = useCallback(() => {
    // 🛑 Optimization: Don't load if ref isn't ready or if we've already started a load
    if (!bannerAdViewRef.current || isInitialLoadTriggered.current) {
        return;
    }

    try {
      console.log(`[AppBanner] 🚀 Loading ${size} ad...`);
      isInitialLoadTriggered.current = true;
      bannerAdViewRef.current.loadAd();
    } catch (error) {
      console.error("[AppBanner] Load Error:", error);
      isInitialLoadTriggered.current = false;
    }
  }, [size]);

  const adListener = useMemo(() => ({
    onAdLoaded: (adInfo) => {
      console.log(`[AppBanner] ✅ LOADED: ${size}`);
      setLoaded(true);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    onAdLoadFailed: (error) => {
      console.error(`[AppBanner] ❌ FAILED: ${JSON.stringify(error)}`);
      setLoaded(false);
      isInitialLoadTriggered.current = false; // Reset so retry can work
      
      if (retryTimer.current) clearTimeout(retryTimer.current);
      // 📉 DATA SAVER: Wait 60 seconds before retrying to save user data/bandwidth
      retryTimer.current = setTimeout(() => {
        loadAdInternal();
      }, 60000); 
    },
    onAdClicked: (adInfo) => console.log(`[AppBanner] 🖱️ Ad Clicked`),
    onAdDisplayed: (adInfo) => console.log("[AppBanner] 👁️ Impression Recorded"),
    onAdDisplayFailed: (adInfo, error) => {
        console.log(`[AppBanner] ⚠️ Display Failed:`);
        isInitialLoadTriggered.current = false;
    },
    onAdExpanded: (adInfo) => console.log("[AppBanner] ↕️ Expanded"),
    onAdCollapsed: (adInfo) => console.log("[AppBanner] ↔️ Collapsed"),
    onAdLeftApplication: (adInfo) => console.log("[AppBanner] 💨 Left Application"),
  }), [size, loadAdInternal]);

  useEffect(() => {
    setShouldRender(true);

    // Initial load trigger with a slight delay to let UI threads breathe
    const initLoadTimer = setTimeout(() => {
        loadAdInternal();
    }, 1000);
    
    return () => {
      clearTimeout(initLoadTimer);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (bannerAdViewRef.current) {
        // 🧹 MEMORY CLEANUP: Crucial to prevent lag when navigating away
        bannerAdViewRef.current.destroy();
        bannerAdViewRef.current = null;
      }
    };
  }, []); // Removed loadAdInternal from deps to ensure useEffect only runs ONCE on mount

  if (Platform.OS === 'web') return null;

  return (
    <View 
      style={{  
        width: '100%', 
        alignItems: 'center', 
        justifyContent: 'center',
        marginVertical: 15,
        minHeight: layout.height, 
      }}
    >
      {/* LOADING STATE UI */}
      {!loaded && (
        <View style={{ 
          position: 'absolute', 
          height: layout.height, 
          width: layout.width, 
          justifyContent: 'center', 
          alignItems: 'center',
          backgroundColor: 'rgba(10, 10, 10, 0.8)', // Darker background saves OLED battery
          borderRadius: 12,
          borderWidth: 1,
          borderColor: 'rgba(59, 130, 246, 0.2)',
        }}>
          <ActivityIndicator size="small" color="#3b82f6" />
          <Text style={{ fontSize: 8, color: '#3b82f6', marginTop: 8, fontWeight: '900', letterSpacing: 2 }}>
            NEURAL_LINK_ESTABLISHING...
          </Text>
        </View>
      )}

      {/* AD VIEW CONTAINER */}
      <View style={{ width: layout.width, height: layout.height, opacity: loaded ? 1 : 0 }}>
        {shouldRender && (
          <LevelPlayBannerAdView
            key={`banner_${size}_${BANNER_ID}`} 
            ref={bannerAdViewRef}
            adUnitId={BANNER_ID}
            adSize={layout.sdkSize}
            placementName={size === 'MREC' ? 'DefaultMREC' : 'DefaultBanner'} 
            listener={adListener}
            onLayout={(e) => {
              // Safety fallback only
              if (!isInitialLoadTriggered.current) {
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