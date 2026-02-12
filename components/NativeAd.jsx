import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Platform, Text as RNText, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
// 🔹 LevelPlay imports
import { LevelPlayNativeAd, LevelPlayNativeAdView } from "unity-levelplay-mediation";
import { AdConfig } from "../utils/AdConfig";

const NATIVE_AD_UNIT_ID = String(AdConfig.native || "0").trim();
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

/* ================== AUTHOR STYLE ================== */
export const NativeAdAuthorStyle = ({ isDark }) => {
  const [adData, setAdData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [adInstance, setAdInstance] = useState(null);
  const timeoutRef = useRef(null);
  const retryCountRef = useRef(0);
  const isMountedRef = useRef(true);

  const loadAd = useCallback(() => {
    if (!isMountedRef.current) return;
    if (NATIVE_AD_UNIT_ID === "0") {
      setError(true);
      return;
    }

    // Reset states for fresh attempt
    setError(false);
    setLoaded(false);

    const adListener = {
      onAdLoaded: (adInfo, nativeAdData) => {
        if (isMountedRef.current) {
          console.log("✅ [Author Ad] Loaded:", adInfo?.adNetwork || "Unknown");
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          setAdData(nativeAdData);
          setLoaded(true);
          setError(false);
          retryCountRef.current = 0; // Reset retries on success
        }
      },
      onAdLoadFailed: (adUnitId, err) => {
        if (isMountedRef.current) {
          console.error("❌ [Author Ad] Failed:", adUnitId, err);
          handleRetry();
        }
      },
      onAdClicked: (adInfo) => console.log("Author Native Ad Clicked"),
    };

    const handleRetry = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1;
        console.log(`🔄 [Author Ad] Retrying (${retryCountRef.current}/${MAX_RETRIES})...`);
        setTimeout(() => loadAd(), RETRY_DELAY);
      } else {
        setError(true);
      }
    };

    let nativeAd;
    try {
      nativeAd = new LevelPlayNativeAd(NATIVE_AD_UNIT_ID, null, null, null, null, adListener);
      
      timeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && !loaded) {
          console.warn(`⚠️ [Author Ad] Timeout. Triggering retry...`);
          handleRetry();
        }
      }, 15000);

      nativeAd.loadAd();
      setAdInstance(nativeAd);
    } catch (e) {
      console.error("💥 [Author Ad] Init Error:", e);
      setError(true);
    }
  }, [loaded]);

  useEffect(() => {
    isMountedRef.current = true;
    loadAd();
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (adInstance && adInstance.destroy) adInstance.destroy();
    };
  }, []);

  if (error || !loaded || !adData) {
    return (
      <View
        style={{ height: 140 }}
        className={`mb-3 w-full justify-center items-center rounded-3xl border ${
          isDark ? "bg-[#0f0f0f] border-zinc-800" : "bg-white border-zinc-100"
        }`}
      >
        {!error && <ActivityIndicator color={isDark ? "white" : "#3b82f6"} />}
        {error && (
          <View className="items-center">
            <Ionicons name="cloud-offline-outline" size={16} color="#71717a" />
            <RNText className="text-zinc-500 text-[10px] mt-1">Ad unavailable</RNText>
          </View>
        )}
      </View>
    );
  }

  const adColor = "#3b82f6";

  return (
    <Animated.View key="author-ad-container" entering={FadeInDown.duration(400)} className="mb-3">
      <LevelPlayNativeAdView nativeAd={adInstance} style={{ width: "100%", height: 140 }}>
        <View
          className={`p-4 rounded-3xl border flex-row items-center ${
            isDark ? "bg-[#0f0f0f] border-zinc-800" : "bg-white border-zinc-100 shadow-sm"
          }`}
          style={{ height: 140 }}
        >
          <View style={{ borderColor: adColor }} className="w-16 h-16 rounded-full border-2 p-0.5 overflow-hidden">
            {adData.icon ? (
              <Image source={{ uri: adData.icon }} style={{ width: '100%', height: '100%', borderRadius: 999 }} />
            ) : (
              <View style={{ width: "100%", height: "100%", borderRadius: 999, backgroundColor: isDark ? '#27272a' : '#f4f4f5' }} />
            )}
          </View>

          <View className="flex-1 ml-4 justify-center">
            <View className="flex-row items-center justify-between mb-1">
              <RNText
                numberOfLines={1}
                className={`font-black italic uppercase tracking-tighter text-lg ${isDark ? 'text-white' : 'text-black'}`}
                style={{ flex: 1, marginRight: 8, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-condensed' }}
              >
                {adData.title || adData.headline}
              </RNText>
              <View style={{ backgroundColor: `${adColor}20`, borderColor: `${adColor}40` }} className="px-2 py-0.5 rounded-md border flex-row items-center gap-1">
                <MaterialCommunityIcons name="shield-check" size={8} color={adColor} />
                <RNText style={{ color: adColor }} className="text-[8px] font-black uppercase tracking-widest">SPONSORED</RNText>
              </View>
            </View>

            <RNText numberOfLines={1} className={`text-[11px] font-medium italic mb-2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
              {adData.description || adData.body}
            </RNText>

            <View className="flex-row items-center justify-between mt-1">
              <View className="flex-row items-center gap-3">
                <View className="flex-row items-center">
                  <Ionicons name="star" size={12} color="#fbbf24" />
                  <RNText className="text-[10px] font-bold ml-1 text-zinc-500">Verified</RNText>
                </View>
              </View>
              <View className="bg-blue-600 px-4 py-1.5 rounded-full">
                <RNText style={{ color: "white", fontSize: 9, fontWeight: "900", textTransform: "uppercase" }}>
                  {adData.callToAction}
                </RNText>
              </View>
            </View>
          </View>
        </View>
      </LevelPlayNativeAdView>
    </Animated.View>
  );
};

/* ================== POST STYLE ================== */
export const NativeAdPostStyle = ({ isDark }) => {
  const [adData, setAdData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [adInstance, setAdInstance] = useState(null);
  const timeoutRef = useRef(null);
  const retryCountRef = useRef(0);
  const isMountedRef = useRef(true);

  const loadAd = useCallback(() => {
    if (!isMountedRef.current) return;
    if (NATIVE_AD_UNIT_ID === "0") {
      setError(true);
      return;
    }

    setError(false);
    setLoaded(false);

    const adListener = {
      onAdLoaded: (adInfo, nativeAdData) => {
        if (isMountedRef.current) {
          console.log("✅ [Post Ad] Loaded:", adInfo?.adNetwork || "Unknown");
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          setAdData(nativeAdData);
          setLoaded(true);
          setError(false);
          retryCountRef.current = 0;
        }
      },
      onAdLoadFailed: (adUnitId, err) => {
        if (isMountedRef.current) {
          console.error("❌ [Post Ad] Failed:", adUnitId, err);
          handleRetry();
        }
      },
      onAdClicked: (adInfo) => console.log("Post Native Ad Clicked"),
    };

    const handleRetry = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1;
        console.log(`🔄 [Post Ad] Retrying (${retryCountRef.current}/${MAX_RETRIES})...`);
        setTimeout(() => loadAd(), RETRY_DELAY);
      } else {
        setError(true);
      }
    };

    let nativeAd;
    try {
      nativeAd = new LevelPlayNativeAd(NATIVE_AD_UNIT_ID, null, null, null, null, adListener);
      
      timeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && !loaded) {
          console.warn(`⚠️ [Post Ad] Timeout. Retrying...`);
          handleRetry();
        }
      }, 15000);

      nativeAd.loadAd();
      setAdInstance(nativeAd);
    } catch (e) {
      console.error("💥 [Post Ad] Init Error:", e);
      setError(true);
    }
  }, [loaded]);

  useEffect(() => {
    isMountedRef.current = true;
    loadAd();
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (adInstance && adInstance.destroy) adInstance.destroy();
    };
  }, []);

  if (error || !loaded || !adData) {
    return (
      <View
        style={{ height: 350 }}
        className={`mb-5 w-full justify-center items-center rounded-[2.5rem] border ${
          isDark ? "bg-zinc-900/40 border-zinc-800" : "bg-white border-zinc-100"
        }`}
      >
        {!error && <ActivityIndicator color={isDark ? "white" : "#3b82f6"} />}
        {error && (
          <View className="items-center">
            <MaterialCommunityIcons name="alert-circle-outline" size={24} color="#71717a" />
            <RNText className="text-zinc-500 text-[10px] mt-2">Ad could not load</RNText>
          </View>
        )}
      </View>
    );
  }

  return (
    <Animated.View key="post-ad-container" entering={FadeIn.duration(500)} className="mb-5">
      <LevelPlayNativeAdView nativeAd={adInstance} style={{ width: "100%", height: 350 }}>
        <View
          className={`rounded-[2.5rem] border overflow-hidden ${
            isDark ? "bg-zinc-900/40 border-zinc-800" : "bg-white border-zinc-100 shadow-sm"
          }`}
          style={{ height: 350 }}
        >
          {adData.media ? (
             <Image source={{ uri: adData.media }} style={{ width: "100%", height: 190, backgroundColor: isDark ? "#111" : "#eee" }} />
          ) : (
            <View style={{ width: "100%", height: 190, backgroundColor: isDark ? "#111" : "#eee" }} />
          )}

          <View className="p-5">
            <View className="flex-row justify-between items-center mb-3">
              <View className="bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                <RNText className="text-amber-500 text-[8px] font-black uppercase tracking-widest">Promoted Content</RNText>
              </View>
              <RNText className="text-zinc-500 text-[10px] font-bold uppercase tracking-tighter">
                <RNText className={`${isDark ? 'text-zinc-600' : 'text-zinc-400'} font-normal`}>AD:</RNText> Verified Partner
              </RNText>
            </View>

            <RNText className={`font-black text-xl mb-1 leading-tight tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>
              {adData.title || adData.headline}
            </RNText>

            <RNText className={`${isDark ? 'text-zinc-400' : 'text-zinc-500'} text-xs mb-4 italic`} numberOfLines={2}>
              {adData.description || adData.body}
            </RNText>

            <View className={`flex-row items-center justify-between pt-4 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
              <View className="flex-row items-center">
                <Ionicons name="megaphone" size={14} color="#3b82f6" />
                <RNText className="text-[11px] font-black text-zinc-500 ml-1.5 uppercase">Featured ad</RNText>
              </View>
              <View className="bg-blue-600 px-6 py-2 rounded-full">
                <RNText style={{ color: "white", fontSize: 10, fontWeight: "900", textTransform: "uppercase" }}>
                  {adData.callToAction}
                </RNText>
              </View>
            </View>
          </View>
        </View>
      </LevelPlayNativeAdView>
    </Animated.View>
  );
};