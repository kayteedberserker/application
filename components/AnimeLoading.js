import { MaterialCommunityIcons } from "@expo/vector-icons"; // ⚡️ ADDED IMPORT
import { BlurMask, Canvas, Circle } from "@shopify/react-native-skia";
import React, { useEffect, useState } from 'react';
import { Dimensions, Text as RNText, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  FadeInDown,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

// 🎮 SCOPED GAME TIPS DICTIONARY (UPDATED WITH LORE)
const SYSTEM_TIPS = {
    general: [
        "SYSTEM: Maintain your daily login streak. A broken streak can be restored by burning OC.",
        "SYSTEM: Lost in the meta? Consult the System Directory for complete operational intel.",
        "SYSTEM: Ensure your neural link (network connection) is stable to prevent transmission failure.",
        "SYSTEM: Modify your Operator Signature. A customized profile commands respect in the global feed.",
        "SYSTEM: Augment your Player Scroll with borders, watermarks, and glows, then dispatch it to the network."
    ],
    post: [
        "SYSTEM: Monarchs of the network who hoard the most AURA emit a unique visual resonance on their Player Card.",
        "SYSTEM: Cross-comm engagement is vital. Comment on allied transmissions to boost your algorithm presence.",
        "SYSTEM: Deploy Poll Transmissions to let the global network vote and settle syndicate disputes.",
        "SYSTEM: AURA is generated through network resonance. Broadcast high-value intel to farm it rapidly.",
        "SYSTEM: Consistency is power. Maintain a steady transmission rate to accelerate your Awakening."
    ],
    clan: [
        "SYSTEM: Initiate Clan Wars to plunder rival syndicates and secure massive point spikes.",
        "SYSTEM: In debt? A single successful transmission triggers the REDEMPTION protocol, resetting your balance to zero.",
        "WARNING: Syndicates that sink to -3,000 points are classified as dead weight and permanently purged by THE SYSTEM.",
        "SYSTEM: Display your acquired Clan Badges on your scroll to flex your syndicate's combat history.",
        "SYSTEM: Coordinate with your clanmates. The weekly point decay spares no one on the Global Leaderboard."
    ],
    wallet: [
        "SYSTEM: Burn OC in the Vault to decrypt exclusive player borders, backgrounds, and visual augments.",
        "SYSTEM: Clan Coins (CC) are locked to the Syndicate Vault. Pool resources to buff your entire clan.",
        "SYSTEM: Ascend to Peak Level 10 to unlock MYTHIC status and rewrite your system permissions.",
        "SYSTEM: Injecting external funds to acquire OC yields Peak Points. Ascend the VIP ranks.",
        "SYSTEM: Need to fund an ally? Execute a peer-to-peer OC transfer to keep their operations active."
    ]
};

/**
 * Reusable Anime/Gaming Loading Component
 * Scaled down and color-boosted for a high-energy "Neon" feel.
 * * @param {string} tipType - "general" | "post" | "clan" | "wallet"
 */
const AnimeLoading = ({ message = "FETCHING", subMessage = "Synchronizing Universe...", tipType = "general" }) => {
    const [currentTip, setCurrentTip] = useState("");

    // Shared values
    const rotation = useSharedValue(0);
    const pulse = useSharedValue(1);
    const float = useSharedValue(0);
    const wave = useSharedValue(0);
    const barProgress = useSharedValue(-160); 

    useEffect(() => {
        // Pick a random tip based on the passed tipType
        const availableTips = SYSTEM_TIPS[tipType] || SYSTEM_TIPS.general;
        setCurrentTip(availableTips[Math.floor(Math.random() * availableTips.length)]);

        // 1. Kinetic Rotation
        rotation.value = withRepeat(withTiming(1, { duration: 2500 }), -1, false);

        // 2. Pulsing Core
        pulse.value = withRepeat(
            withSequence(withTiming(1.15, { duration: 600 }), withTiming(1, { duration: 600 })),
            -1, true
        );

        // 3. Floating Text
        float.value = withRepeat(
            withSequence(withTiming(-6, { duration: 1200 }), withTiming(0, { duration: 1200 })),
            -1, true
        );

        // 4. Energy Pulse Wave
        wave.value = withRepeat(withTiming(1, { duration: 1500 }), -1, false);

        // 5. Progress Bar
        barProgress.value = withRepeat(withTiming(160, { duration: 1200 }), -1, false);
    }, [tipType, rotation, pulse, float, wave, barProgress]); 

    // Animated Styles
    const outerRingStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value * 360}deg` }],
    }));

    const innerRingStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${-rotation.value * 720}deg` }],
    }));

    const coreStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }, { rotate: '45deg' }],
    }));

    const waveStyle = useAnimatedStyle(() => ({
        transform: [{ scale: wave.value * 2 }],
        opacity: 1 - wave.value,
    }));

    const floatTextStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: float.value }],
    }));

    const progressBarStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: barProgress.value }],
    }));

    // ⚡️ TIP PARSING LOGIC
    const isWarning = currentTip.startsWith("WARNING:");
    const prefix = isWarning ? "WARNING:" : "SYSTEM:";
    const cleanMessage = currentTip.replace(prefix, "").trim();
    const prefixColor = isWarning ? "#ef4444" : "#06b6d4"; // Red for Warning, Cyan for System

    return (
        <View className="flex-1 justify-center items-center bg-[#f8fafc] dark:bg-[#020617] relative px-6">
            
            {/* ⚡️ SKIA BACKGROUND GLOW */}
            <View className="absolute inset-0 pointer-events-none items-center justify-center">
                <Canvas style={{ width: 300, height: 300 }}>
                    <Circle cx={150} cy={150} r={80} color="rgba(6, 182, 212, 0.15)">
                        <BlurMask blur={40} style="normal" />
                    </Circle>
                </Canvas>
            </View>

            {/* --- YOUR ORIGINAL ANIMATION RINGS --- */}
            <View className="relative items-center justify-center">
                
                {/* Expanding Energy Wave */}
                <Animated.View 
                    style={[
                        waveStyle,
                        {
                            width: 60, height: 60, borderRadius: 30, borderWidth: 1,
                            borderColor: '#06b6d4', position: 'absolute',
                        }
                    ]}
                />

                {/* Outer Orbital */}
                <Animated.View 
                    style={[
                        outerRingStyle,
                        {
                            width: 100, height: 100, borderWidth: 1.5, borderColor: '#06b6d4',
                            borderStyle: 'dashed', borderRadius: 50, position: 'absolute', opacity: 0.5,
                        }
                    ]}
                />

                {/* Inner Hex Frame */}
                <Animated.View 
                    style={[
                        innerRingStyle,
                        {
                            width: 70, height: 70, borderWidth: 3,
                            borderLeftColor: '#2563eb', borderRightColor: '#0ea5e9',
                            borderTopColor: 'transparent', borderBottomColor: 'transparent',
                            borderRadius: 15, position: 'absolute',
                        }
                    ]}
                />

                {/* Core Power Crystal */}
                <Animated.View 
                    style={[
                        coreStyle,
                        {
                            width: 28, height: 28, backgroundColor: '#06b6d4', borderRadius: 4,
                            shadowColor: '#06b6d4', shadowRadius: 15, shadowOpacity: 0.9,
                            elevation: 12, borderWidth: 1, borderColor: '#ffffff',
                        }
                    ]}
                />
            </View>

            {/* --- HUD TEXT --- */}
            <Animated.View style={floatTextStyle} className="mt-20 items-center">
                <View>
                    <RNText className="absolute -top-0.5 -left-0.5 text-4xl font-black italic uppercase text-cyan-500 opacity-20">
                         {message}
                    </RNText>
                    <RNText className="text-4xl font-black italic uppercase text-slate-900 dark:text-cyan-50">
                         {message}
                    </RNText>
                </View>

                {/* Status Badge */}
                <View 
                    className="flex-row items-center mt-3 bg-cyan-600 dark:bg-blue-600 px-4 py-0.5"
                    style={{ transform: [{ skewX: '-15deg' }], shadowColor: '#06b6d4', shadowOpacity: 0.4, shadowRadius: 8 }}
                >
                     <RNText 
                       className="text-[8px] font-bold text-white uppercase tracking-[0.4em]"
                       style={{ transform: [{ skewX: '15deg' }] }}
                     >
                        {subMessage}
                     </RNText>
                </View>

                {/* Experience Bar Style Loader */}
                <View className="w-40 h-1 bg-slate-200 dark:bg-slate-800 mt-10 overflow-hidden rounded-full border border-slate-300/30 dark:border-blue-900/30">
                    <Animated.View 
                        className="h-full bg-cyan-500 w-full" 
                        style={[
                            progressBarStyle,
                            { shadowColor: '#06b6d4', shadowOpacity: 1, shadowRadius: 4 }
                        ]}
                    />
                </View>
                
                {/* Tech Bits */}
                <View className="flex-row gap-2 mt-4 opacity-40">
                    <View className="w-3 h-0.5 bg-cyan-500 rounded-full" />
                    <View className="w-1 h-0.5 bg-cyan-500 rounded-full" />
                    <View className="w-3 h-0.5 bg-cyan-500 rounded-full" />
                </View>
            </Animated.View>

            {/* ⚡️ SCOPED SYSTEM TIPS (Positioned at the bottom, dynamically styled) */}
            {currentTip ? (
                <Animated.View entering={FadeInDown.duration(800).delay(300)} className="absolute bottom-[80px] px-8 w-full items-center">
                    <View className="bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10 p-4 rounded-2xl w-full max-w-sm flex-row items-start">
                        {/* ⚡️ Dynamic Icon */}
                        <View className="mt-0.5 mr-2 opacity-80">
                            <MaterialCommunityIcons
                                name={isWarning ? "alert-octagon" : "console"}
                                size={14}
                                color={prefixColor}
                            />
                        </View>
                        
                        {/* ⚡️ Dynamic Text Coloring */}
                        <RNText className="text-slate-600 dark:text-slate-300 font-bold text-[10px] uppercase tracking-widest leading-relaxed flex-1">
                            <RNText style={{ color: prefixColor, fontWeight: '900' }}>
                                {prefix} 
                            </RNText>
                            {" " + cleanMessage}
                        </RNText>
                    </View>
                </Animated.View>
            ) : null}
        </View>
    );
};

export default AnimeLoading;