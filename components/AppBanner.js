import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { LevelPlayAdSize, LevelPlayBannerAdView } from 'unity-levelplay-mediation';
import { AdConfig } from '../utils/AdConfig';

const BANNER_ID = AdConfig.banner || "97tambjxr88508m5";

const AppBanner = ({ size = 'MREC' }) => {
  const [loaded, setLoaded] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  
  // Debug State
  const [logs, setLogs] = useState([]);
  const [showDebug, setShowDebug] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const tapTimer = useRef(null);

  const bannerAdViewRef = useRef(null);
  const isInitialLoadTriggered = useRef(false);
  const retryTimer = useRef(null);

  const addLog = (msg) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, 30));
  };

  const layout = useMemo(() => {
    const s = size.toUpperCase();
    if (s === 'BANNER') return { sdkSize: LevelPlayAdSize.BANNER, width: 320, height: 50 };
    if (s === 'LARGE') return { sdkSize: LevelPlayAdSize.LARGE, width: 320, height: 90 };
    return { sdkSize: LevelPlayAdSize.MEDIUM_RECTANGLE, width: 300, height: 250 };
  }, [size]);

  const loadAdInternal = useCallback(() => {
    if (isInitialLoadTriggered.current) return;
    
    if (bannerAdViewRef.current) {
      addLog(`🚀 Calling loadAd() for ${size}...`);
      isInitialLoadTriggered.current = true;
      bannerAdViewRef.current.loadAd();
    } else {
      addLog(`⚠️ Cannot load: bannerAdViewRef is NULL`);
    }
  }, [size]);

  const handleDebugTap = () => {
    const newCount = tapCount + 1;
    setTapCount(newCount);
    if (newCount >= 5) {
      setShowDebug(true);
      setTapCount(0);
    }
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => setTapCount(0), 2000);
  };

  const adListener = useMemo(() => ({
    onAdLoaded: (adInfo) => {
      addLog(`✅ LOADED: ${adInfo.adUnit} | Network: ${adInfo.networkName}`);
      setLoaded(true);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    onAdLoadFailed: (error) => {
      addLog(`❌ LOAD FAILED: ${error.message} (Code: ${error.code})`);
      setLoaded(false);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => {
        isInitialLoadTriggered.current = false;
        loadAdInternal();
      }, 30000); 
    },
    onAdClicked: (adInfo) => addLog("🖱️ Ad Clicked"),
    onAdDisplayed: (adInfo) => addLog("👁️ Impression Recorded"),
    onAdDisplayFailed: (adInfo, error) => addLog(`⚠️ Display Failed: ${error.message}`),
    onAdExpanded: (adInfo) => addLog("↕️ Expanded"),
    onAdCollapsed: (adInfo) => addLog("↔️ Collapsed"),
    onAdLeftApplication: (adInfo) => addLog("💨 Left Application"),
  }), [size, loadAdInternal]);

  useEffect(() => {
    addLog("--- New Session Start ---");
    addLog(`Target Size: ${size} | ID: ${BANNER_ID}`);
    
    const renderTimer = setTimeout(() => {
        setShouldRender(true);
        addLog("shouldRender set to TRUE");
    }, 500);

    // 🚩 FALLBACK: If onLayout fails to fire, try loading manually after a delay
    const fallbackTimer = setTimeout(() => {
        if (!isInitialLoadTriggered.current) {
            addLog("⏰ onLayout timeout - forcing load...");
            loadAdInternal();
        }
    }, 3000);
    
    return () => {
      clearTimeout(renderTimer);
      clearTimeout(fallbackTimer);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (bannerAdViewRef.current) {
        addLog("Destroying Banner Instance");
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
        minHeight: layout.height, // Ensure container has height
      }}
    >
      <TouchableOpacity 
        activeOpacity={1} 
        onPress={handleDebugTap}
        style={{ position: 'absolute', width: '100%', height: '100%', zIndex: 10 }}
      />

      <Modal visible={showDebug} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#020617' }}>
          <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: '#1e293b', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>Ad Engine Diagnostics</Text>
            <TouchableOpacity onPress={() => setShowDebug(false)} style={{ backgroundColor: '#ef4444', padding: 8, borderRadius: 8 }}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>CLOSE</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, padding: 15 }}>
            <TouchableOpacity 
                onPress={() => {
                    isInitialLoadTriggered.current = false;
                    loadAdInternal();
                }}
                style={{ backgroundColor: '#3b82f6', padding: 12, borderRadius: 8, marginBottom: 20 }}
            >
                <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>FORCE MANUAL LOAD</Text>
            </TouchableOpacity>
            {logs.map((log, i) => (
              <Text key={i} style={{ color: log.includes('❌') ? '#f87171' : (log.includes('✅') ? '#4ade80' : '#e2e8f0'), fontFamily: 'monospace', fontSize: 11, marginBottom: 8, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: '#1e293b' }}>
                {log}
              </Text>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {!loaded && (
        <View style={{ 
          position: 'absolute', 
          height: layout.height, 
          width: layout.width, 
          justifyContent: 'center', 
          alignItems: 'center',
          backgroundColor: 'rgba(59, 130, 246, 0.05)',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: 'rgba(59, 130, 246, 0.1)',
        }}>
          <ActivityIndicator size="small" color="#3b82f6" />
          <Text style={{ fontSize: 9, color: '#3b82f6', marginTop: 8, fontWeight: '900', letterSpacing: 1 }}>
            INITIALIZING NEURAL LINK...
          </Text>
        </View>
      )}

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
              addLog(`📏 onLayout Fired: ${Math.round(e.nativeEvent.layout.width)}x${Math.round(e.nativeEvent.layout.height)}`);
              loadAdInternal();
            }}
            style={{ width: layout.width, height: layout.height }}
          />
        )}
      </View>
    </View>
  );
};

export default AppBanner;