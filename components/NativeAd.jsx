import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Text as RNText, View } from "react-native";
import {
  NativeAd,
  NativeAdView,
  NativeMediaView
} from "react-native-google-mobile-ads";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

const AD_UNIT_ID = "ca-app-pub-8021671365048667/9973628010";

/* ================== AUTHOR STYLE ================== */
export const NativeAdAuthorStyle = ({ isDark }) => {
  const [nativeAd, setNativeAd] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadAd = () => {
      NativeAd.createForAdRequest(AD_UNIT_ID)
        .then((ad) => {
          if (isMounted) {
            setNativeAd(ad);
            setLoaded(true);
            setError(false);
          }
        })
        .catch(() => {
          if (isMounted) {
            setError(true);
            // retry after 10s as per logic intent
            setTimeout(() => {
              if (isMounted) loadAd();
            }, 10000); 
          }
        });
    };

    loadAd();

    return () => {
      isMounted = false;
    };
  }, []);

  if (error || !loaded || !nativeAd) {
    return (
      <View
        style={{ height: 140 }}
        className={`mb-3 w-full justify-center items-center rounded-3xl border ${
          isDark ? "bg-[#0f0f0f] border-zinc-800" : "bg-white border-zinc-100"
        }`}
      >
        {!error && <ActivityIndicator color={isDark ? "white" : "#3b82f6"} />}
        {error && <RNText className="text-zinc-500 text-[10px]">Ad unavailable</RNText>}
      </View>
    );
  }

  const adColor = "#3b82f6";

  return (
    <Animated.View
      key="author-ad-container"
      entering={FadeInDown.duration(400)}
      className="mb-3"
    >
      <NativeAdView 
        nativeAd={nativeAd} 
        style={{ width: "100%", height: 140 }}
        adChoicesPlacement="topRight"
      >
        <View
          className={`p-4 rounded-3xl border flex-row items-center ${
            isDark ? "bg-[#0f0f0f] border-zinc-800" : "bg-white border-zinc-100 shadow-sm"
          }`}
          style={{ height: 140 }}
        >
          {/* AD ICON */}
          <View style={{ borderColor: adColor }} className="w-16 h-16 rounded-full border-2 p-0.5 overflow-hidden">
            <NativeMediaView
              nativeID="adMediaView"
              style={{ width: "100%", height: "100%", borderRadius: 999, backgroundColor: isDark ? '#27272a' : '#f4f4f5' }}
            />
          </View>

          <View className="flex-1 ml-4 justify-center">
            <View className="flex-row items-center justify-between mb-1">
              <RNText
                nativeID="adHeadlineView"
                numberOfLines={1}
                className={`font-black italic uppercase tracking-tighter text-lg ${isDark ? 'text-white' : 'text-black'}`}
                style={{ flex: 1, marginRight: 8, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-condensed' }}
              >
                {nativeAd.headline}
              </RNText>
              <View style={{ backgroundColor: `${adColor}20`, borderColor: `${adColor}40` }} className="px-2 py-0.5 rounded-md border flex-row items-center gap-1">
                <MaterialCommunityIcons name="shield-check" size={8} color={adColor} />
                <RNText style={{ color: adColor }} className="text-[8px] font-black uppercase tracking-widest">SPONSORED</RNText>
              </View>
            </View>

            <RNText
              nativeID="adTaglineView"
              numberOfLines={1}
              className={`text-[11px] font-medium italic mb-2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}
            >
              {nativeAd.tagline}
            </RNText>

            <View className="flex-row items-center justify-between mt-1">
              <View className="flex-row items-center gap-3">
                <View className="flex-row items-center">
                  <Ionicons name="star" size={12} color="#fbbf24" />
                  <RNText className="text-[10px] font-bold ml-1 text-zinc-500">Verified</RNText>
                </View>
              </View>

              <View className="bg-blue-600 px-4 py-1.5 rounded-full">
                <RNText
                  nativeID="adCallToActionView"
                  style={{ color: "white", fontSize: 9, fontWeight: "900", textTransform: "uppercase" }}
                >
                  {nativeAd.callToAction}
                </RNText>
              </View>
            </View>
          </View>
        </View>
      </NativeAdView>
    </Animated.View>
  );
};

/* ================== POST STYLE ================== */
export const NativeAdPostStyle = ({ isDark }) => {
  const [nativeAd, setNativeAd] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadAd = () => {
      NativeAd.createForAdRequest(AD_UNIT_ID)
        .then((ad) => {
          if (isMounted) {
            setNativeAd(ad);
            setLoaded(true);
            setError(false);
          }
        })
        .catch(() => {
          console.log("failed");
          if (isMounted) {
            setError(true);
            console.log("failed to load");
            // retry after 10s
            setTimeout(() => {
              console.log("retrying to load native");
              if (isMounted) loadAd();
            }, 10000);
          }
        });
    };

    loadAd();

    return () => {
      isMounted = false;
    };
  }, []);

  if (error || !loaded || !nativeAd) {
    return (
      <View
        style={{ height: 350 }}
        className={`mb-5 w-full justify-center items-center rounded-[2.5rem] border ${
          isDark ? "bg-zinc-900/40 border-zinc-800" : "bg-white border-zinc-100"
        }`}
      >
        {!error && <ActivityIndicator color={isDark ? "white" : "#3b82f6"} />}
        {error && <RNText className="text-zinc-500 text-[10px]">Ad could not load</RNText>}
      </View>
    );
  }

  return (
    <Animated.View
      key="post-ad-container"
      entering={FadeIn.duration(500)}
      className="mb-5"
    >
      <NativeAdView 
        nativeAd={nativeAd} 
        style={{ width: "100%", height: 350 }}
        adChoicesPlacement="topRight"
      >
        <View
          className={`rounded-[2.5rem] border overflow-hidden ${
            isDark ? "bg-zinc-900/40 border-zinc-800" : "bg-white border-zinc-100 shadow-sm"
          }`}
          style={{ height: 350 }}
        >
          <NativeMediaView
            nativeID="adMediaView"
            style={{ width: "100%", height: 190, backgroundColor: isDark ? "#111" : "#eee", margin: "auto" }}
          />

          <View className="p-5">
            <View className="flex-row justify-between items-center mb-3">
              <View className="bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                <RNText className="text-amber-500 text-[8px] font-black uppercase tracking-widest">Promoted Content</RNText>
              </View>
              <RNText className="text-zinc-500 text-[10px] font-bold uppercase tracking-tighter">
                <RNText className={`${isDark ? 'text-zinc-600' : 'text-zinc-400'} font-normal`}>AD:</RNText> Verified Partner
              </RNText>
            </View>

            <RNText
              nativeID="adHeadlineView"
              className={`font-black text-xl mb-1 leading-tight tracking-tight ${isDark ? 'text-white' : 'text-black'}`}
            >
              {nativeAd.headline}
            </RNText>

            <RNText
              nativeID="adTaglineView"
              className={`${isDark ? 'text-zinc-400' : 'text-zinc-500'} text-xs mb-4 italic`}
              numberOfLines={2}
            >
              {nativeAd.tagline || nativeAd.body}
            </RNText>

            <View className={`flex-row items-center justify-between pt-4 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
              <View className="flex-row items-center">
                <Ionicons name="megaphone" size={14} color="#3b82f6" />
                <RNText className="text-[11px] font-black text-zinc-500 ml-1.5 uppercase">Featured ad</RNText>
              </View>

              <View className="bg-blue-600 px-6 py-2 rounded-full">
                <RNText
                  nativeID="adCallToActionView"
                  style={{ color: "white", fontSize: 10, fontWeight: "900", textTransform: "uppercase" }}
                >
                  {nativeAd.callToAction}
                </RNText>
              </View>
            </View>
          </View>
        </View>
      </NativeAdView>
    </Animated.View>
  );
};