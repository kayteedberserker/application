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
// 🔹 LevelPlay SDK imports
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

  // Helper to add logs
  const addLog = (msg) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, 20));
  };

  const layout = useMemo(() => {
    const s = size.toUpperCase();
    if (s === 'BANNER') return { sdkSize: LevelPlayAdSize.BANNER, width: 320, height: 50 };
    if (s === 'LARGE') return { sdkSize: LevelPlayAdSize.LARGE, width: 320, height: 90 };
    return { sdkSize: LevelPlayAdSize.MEDIUM_RECTANGLE, width: 300, height: 250 };
  }, [size]);

  const loadAdInternal = useCallback(() => {
    addLog(`Initiating Load for ${size}...`);
    if (bannerAdViewRef.current) {
      bannerAdViewRef.current.loadAd();
    }
  }, [size]);

  // Handle Secret Tap (5 taps to open)
  const handleDebugTap = () => {
    const newCount = tapCount + 1;
    setTapCount(newCount);
    
    if (newCount >= 5) {
      setShowDebug(true);
      setTapCount(0);
    }

    // Reset tap count if user pauses
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => setTapCount(0), 2000);
  };

  const adListener = useMemo(() => ({
    onAdLoaded: (adInfo) => {
      addLog(`✅ Success: ${adInfo.adUnit} loaded from ${adInfo.auctionId.slice(0, 8)}...`);
      setLoaded(true);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    onAdLoadFailed: (error) => {
      addLog(`❌ FAILED: ${error.message} (Code: ${error.code})`);
      setLoaded(false);
      
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => {
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
    const timer = setTimeout(() => setShouldRender(true), 1000);
    addLog("Component Mounted - Waiting for SDK...");
    
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
      }}
    >
      {/* Tap Overlay (The Secret Trigger) */}
      <TouchableOpacity 
        activeOpacity={1} 
        onPress={handleDebugTap}
        style={{ position: 'absolute', width: layout.width, height: layout.height, zIndex: 10 }}
      />

      {/* 🔹 DEBUG MODAL */}
      <Modal visible={showDebug} animationType="slide" transparent={false}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
          <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: '#1e293b', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>Ad Logic Logs ({size})</Text>
            <TouchableOpacity onPress={() => setShowDebug(false)} style={{ backgroundColor: '#ef4444', padding: 8, borderRadius: 8 }}>
              <Text style={{ color: '#fff' }}>Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, padding: 15 }}>
            <Text style={{ color: '#94a3b8', marginBottom: 10 }}>Unit ID: {BANNER_ID}</Text>
            {logs.map((log, i) => (
              <Text key={i} style={{ color: log.includes('❌') ? '#f87171' : (log.includes('✅') ? '#4ade80' : '#e2e8f0'), fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 12, marginBottom: 8, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: '#334155' }}>
                {log}
              </Text>
            ))}
            {logs.length === 0 && <Text style={{ color: '#64748b' }}>No logs recorded yet...</Text>}
          </ScrollView>
        </SafeAreaView>
      </Modal>

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
        }}>
          <ActivityIndicator size="small" color="#3b82f6" />
          {layout.height > 60 && (
            <Text style={{ fontSize: 10, color: '#3b82f6', marginTop: 10, fontWeight: '600' }}>
              RECRUITING ADS...
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