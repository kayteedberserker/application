import React from "react";
import { View, Platform } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import NativeAdView, { 
  CallToActionView, 
  HeadlineView, 
  TaglineView, 
  IconView, 
  ImageView, 
  AdBadge 
} from "react-native-google-mobile-ads"; // Ensure this is installed
import { Text } from "./Text";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";

// --- NATIVE AD: AUTHOR STYLE ---
// Mimics the horizontal AuthorCard
export const NativeAdAuthorStyle = ({ isDark }) => {
  return (
    <NativeAdView
      style={{ width: '100%' }}
      // Replace with your actual Ad Unit ID
      adUnitID={Platform.OS === 'ios' ? 'ca-app-pub-3940256099942544/3986624511' : 'ca-app-pub-8021671365048667/1282169688'}
    >
      <Animated.View 
        entering={FadeInDown.duration(400)}
        className={`mb-3 p-4 rounded-3xl border ${
          isDark ? "bg-[#0f0f0f] border-zinc-800" : "bg-white border-zinc-100 shadow-sm"
        }`}
      >
        <View className="flex-row items-center">
            {/* AD ICON (Mimics Profile Pic) */}
            <View className="w-16 h-16 rounded-full border-2 border-blue-500 p-0.5 overflow-hidden">
                <IconView className="w-full h-full rounded-full bg-zinc-800" />
            </View>

            <View className="flex-1 ml-4 justify-center">
                <View className="flex-row items-center justify-between mb-1">
                    <HeadlineView 
                        numberOfLines={1} 
                        className={`font-black italic uppercase tracking-tighter text-lg flex-1 mr-2 ${isDark ? 'text-white' : 'text-black'}`} 
                    />
                    {/* AD BADGE (Mandatory for compliance) */}
                    <View className="bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded-md">
                        <Text className="text-amber-500 text-[8px] font-black uppercase tracking-widest">SPONSORED</Text>
                    </View>
                </View>

                <View className="flex-row items-center mb-1">
                    <Text className="text-[10px] font-black italic text-blue-500">
                        🛡️ PROMOTED_OPERATIVE
                    </Text>
                </View>

                <TaglineView 
                    numberOfLines={1} 
                    className={`text-[11px] font-medium italic mb-2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} 
                />

                <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3">
                        <View className="flex-row items-center">
                            <Ionicons name="star" size={12} color="#fbbf24" />
                            <Text className="text-[10px] font-bold ml-1 text-zinc-500">Official</Text>
                        </View>
                    </View>
                    
                    {/* CTA Button mimics your Aura Badge */}
                    <CallToActionView 
                        className="bg-blue-600 px-3 py-1 rounded-full"
                        textStyle={{ color: 'white', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }}
                    />
                </View>
            </View>
        </View>
      </Animated.View>
    </NativeAdView>
  );
};

// --- NATIVE AD: POST STYLE ---
// Mimics the vertical PostSearchCard
export const NativeAdPostStyle = ({ isDark }) => {
  return (
    <NativeAdView
      style={{ width: '100%' }}
      adUnitID={Platform.OS === 'ios' ? 'ca-app-pub-3940256099942544/3986624511' : 'ca-app-pub-8021671365048667/1282169688'}
    >
      <Animated.View 
        entering={FadeIn.duration(500)}
        className={`mb-5 rounded-[2.5rem] border overflow-hidden ${
          isDark ? "bg-zinc-900/40 border-zinc-800" : "bg-white border-zinc-100 shadow-sm"
        }`}
      >
        {/* AD IMAGE (Mimics Post Media) */}
        <ImageView className="w-full h-48 bg-zinc-800" resizeMode="cover" />
        
        <View className="p-5">
            <View className="flex-row justify-between items-center mb-3">
                <View className="bg-blue-600/10 border border-blue-500/20 px-3 py-1 rounded-full">
                    <Text className="text-blue-500 text-[8px] font-black uppercase tracking-widest">ADVERTISEMENT</Text>
                </View>
                <View className="flex-row items-center">
                  <IconView className="w-4 h-4 rounded-full mr-2" />
                  <HeadlineView className="text-zinc-500 text-[10px] font-bold uppercase tracking-tighter" />
                </View>
            </View>
            
            <HeadlineView className={`font-black text-xl mb-2 leading-tight tracking-tight ${isDark ? 'text-white' : 'text-black'}`} />
            <TaglineView className={`${isDark ? 'text-zinc-400' : 'text-zinc-500'} text-xs mb-5 italic`} numberOfLines={2} />
            
            <View className={`flex-row items-center justify-between pt-4 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
                <View className="flex-row items-center">
                    <Ionicons name="megaphone-outline" size={14} color="#3b82f6" />
                    <Text className="text-[11px] font-black text-zinc-500 ml-1.5 uppercase">Direct Transmission</Text>
                </View>
                
                <CallToActionView 
                    className="bg-blue-600 px-6 py-2 rounded-full"
                    textStyle={{ color: 'white', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }}
                />
            </View>
        </View>
      </Animated.View>
    </NativeAdView>
  );
};
