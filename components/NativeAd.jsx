import React, { useState } from "react";
import { View, Platform, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  NativeAdView,
  CallToActionView,
  HeadlineView,
  TaglineView,
  IconView,
  ImageView,
} from "react-native-google-mobile-ads";
import { Text } from "./Text";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";

const AD_UNIT_ID =
  Platform.OS === "ios"
    ? "ca-app-pub-3940256099942544/3986624511"
    : "ca-app-pub-8021671365048667/1282169688";

/* ================== AUTHOR STYLE ================== */
export const NativeAdAuthorStyle = ({ isDark }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <Animated.View entering={FadeInDown.duration(400)} className="mb-3">
      {!loaded && !error && (
        <View
          style={{
            height: 100,
            borderRadius: 24,
            backgroundColor: isDark ? "#18181b" : "#f4f4f5",
            marginBottom: 12,
            justifyContent: "center",
            alignItems: "center",
          }}
          testID="ad-skeleton-author"
        >
          <ActivityIndicator color={isDark ? "white" : "black"} />
        </View>
      )}

      {!error && (
        <NativeAdView
          testID="native-ad-author"
          adUnitID={AD_UNIT_ID}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          style={{ width: "100%", display: loaded ? "flex" : "none" }}
          onAdLoaded={() => setLoaded(true)}
          onAdFailedToLoad={() => setError(true)}
        >
          <View
            className={`p-4 rounded-3xl border flex-row items-center ${
              isDark
                ? "bg-[#0f0f0f] border-zinc-800"
                : "bg-white border-zinc-100 shadow-sm"
            }`}
          >
            <View className="w-16 h-16 rounded-full border-2 border-blue-500 p-0.5 overflow-hidden">
              <IconView
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: 999,
                  backgroundColor: isDark ? "#27272a" : "#f4f4f5",
                }}
              />
            </View>

            <View className="flex-1 ml-4 justify-center">
              <View className="flex-row items-center justify-between mb-1">
                <HeadlineView
                  numberOfLines={1}
                  style={{
                    fontWeight: "900",
                    fontStyle: "italic",
                    textTransform: "uppercase",
                    letterSpacing: -0.5,
                    fontSize: 16,
                    flex: 1,
                    marginRight: 8,
                    color: isDark ? "white" : "black",
                  }}
                />
                <View className="bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded-md">
                  <Text className="text-amber-500 text-[8px] font-black uppercase tracking-widest">
                    SPONSORED
                  </Text>
                </View>
              </View>

              <Text className="text-[10px] font-black italic text-blue-500 mb-1">
                🛡️ PROMOTED_OPERATIVE
              </Text>

              <TaglineView
                numberOfLines={1}
                style={{
                  fontSize: 11,
                  fontWeight: "500",
                  fontStyle: "italic",
                  marginBottom: 8,
                  color: isDark ? "#71717a" : "#a1a1aa",
                }}
              />

              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <Ionicons name="star" size={12} color="#fbbf24" />
                  <Text className="text-[10px] font-bold ml-1 text-zinc-500">
                    Official
                  </Text>
                </View>

                <View className="bg-blue-600 px-3 py-1 rounded-full">
                  <CallToActionView
                    style={{ minHeight: 24 }}
                    textStyle={{
                      color: "white",
                      fontSize: 9,
                      fontWeight: "900",
                      textTransform: "uppercase",
                    }}
                  />
                </View>
              </View>
            </View>
          </View>
        </NativeAdView>
      )}

      {error && (
        <View
          style={{
            height: 100,
            borderRadius: 24,
            backgroundColor: isDark ? "#18181b" : "#f4f4f5",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text className="text-zinc-400 text-[10px]">Ad failed to load</Text>
        </View>
      )}
    </Animated.View>
  );
};

/* ================== POST STYLE ================== */
export const NativeAdPostStyle = ({ isDark }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <Animated.View entering={FadeIn.duration(500)} className="mb-5">
      {!loaded && !error && (
        <View
          style={{
            height: 220,
            borderRadius: 40,
            backgroundColor: isDark ? "#18181b" : "#f4f4f5",
            marginBottom: 12,
            justifyContent: "center",
            alignItems: "center",
          }}
          testID="ad-skeleton-post"
        >
          <ActivityIndicator color={isDark ? "white" : "black"} />
        </View>
      )}

      {!error && (
        <NativeAdView
          testID="native-ad-post"
          adUnitID={AD_UNIT_ID}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          style={{ width: "100%", display: loaded ? "flex" : "none" }}
          onAdLoaded={() => setLoaded(true)}
          onAdFailedToLoad={() => setError(true)}
        >
          <View
            className={`rounded-[2.5rem] border overflow-hidden ${
              isDark
                ? "bg-zinc-900/40 border-zinc-800"
                : "bg-white border-zinc-100 shadow-sm"
            }`}
          >
            <ImageView
              style={{
                width: "100%",
                height: 192,
                backgroundColor: isDark ? "#18181b" : "#f4f4f5",
              }}
            />

            <View className="p-5">
              <View className="flex-row justify-between items-center mb-3">
                <View className="bg-blue-600/10 border border-blue-500/20 px-3 py-1 rounded-full">
                  <Text className="text-blue-500 text-[8px] font-black uppercase tracking-widest">
                    ADVERTISEMENT
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <IconView
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      marginRight: 8,
                    }}
                  />
                  <HeadlineView
                    style={{
                      color: isDark ? "#71717a" : "#a1a1aa",
                      fontSize: 10,
                      fontWeight: "bold",
                      textTransform: "uppercase",
                    }}
                  />
                </View>
              </View>

              <HeadlineView
                style={{
                  fontWeight: "900",
                  fontSize: 20,
                  marginBottom: 8,
                  color: isDark ? "white" : "black",
                  letterSpacing: -0.5,
                }}
              />

              <TaglineView
                numberOfLines={2}
                style={{
                  color: isDark ? "#a1a1aa" : "#71717a",
                  fontSize: 12,
                  marginBottom: 20,
                  fontStyle: "italic",
                }}
              />

              <View
                className={`flex-row items-center justify-between pt-4 border-t ${
                  isDark ? "border-zinc-800" : "border-zinc-100"
                }`}
              >
                <View className="flex-row items-center">
                  <Ionicons
                    name="megaphone-outline"
                    size={14}
                    color="#3b82f6"
                  />
                  <Text className="text-[11px] font-black text-zinc-500 ml-1.5 uppercase">
                    Direct Transmission
                  </Text>
                </View>

                <View className="bg-blue-600 px-6 py-2 rounded-full">
                  <CallToActionView
                    style={{ minHeight: 36 }}
                    textStyle={{
                      color: "white",
                      fontSize: 10,
                      fontWeight: "900",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  />
                </View>
              </View>
            </View>
          </View>
        </NativeAdView>
      )}

      {error && (
        <View
          style={{
            height: 220,
            borderRadius: 40,
            backgroundColor: isDark ? "#18181b" : "#f4f4f5",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text className="text-zinc-400 text-[10px]">Ad failed to load</Text>
        </View>
      )}
    </Animated.View>
  );
};
