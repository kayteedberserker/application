import { Ionicons } from "@expo/vector-icons";
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';
import PeakBadge from "./PeakBadge";
import { Text } from "./Text";

export default function PlayerNameplate({
    author,
    themeColor,
    equippedGlow,
    auraRank = null,
    isDark,
    fontSize = 36,
    showPeakBadge = true,
    showFlame = true
}) {
    const username = author?.username || author?.name || "GUEST";
    const peakLevel = author?.peakLevel || 0;
    const lastStreak = author?.lastStreak || author?.streak || "0";

    const glowConfig = equippedGlow?.visualConfig || {};
    let hasAura = false
    if (auraRank > 0 && auraRank < 5) {
        hasAura = true
    } else if (auraRank == null) {
        hasAura = false
    }

    const hasGlow = !!equippedGlow || hasAura;
    const isAnimated = hasGlow && glowConfig.isAnimated !== false;

    // Strict fallback. If it's not explicitly glitch or pulse, ALWAYS default to sweep.
    let animationType = glowConfig.animationType;
    if (animationType !== 'glitch' && animationType !== 'pulse') {
        animationType = 'sweep';
    }

    const badgeSize = Math.max(16, fontSize * 0.77);
    const flameIconSize = Math.max(12, fontSize * 0.5);

    const progress = useSharedValue(0);
    const glitchX = useSharedValue(0);
    const glitchY = useSharedValue(0);
    const glitchOpacity = useSharedValue(1);
    const pulseAnim = useSharedValue(0);

    const [textDimensions, setTextDimensions] = useState({ width: 0, height: 0 });
    const [isReadyToAnimate, setIsReadyToAnimate] = useState(false);

    useEffect(() => {
        if (!isAnimated) return;

        const timer = setTimeout(() => {
            setIsReadyToAnimate(true);

            if (animationType === 'sweep') {
                progress.value = withRepeat(
                    withTiming(1, { duration: 2500 }),
                    -1, false
                );
            }
            else if (animationType === 'glitch') {
                glitchX.value = withRepeat(
                    withSequence(
                        withTiming(4, { duration: 40 }),
                        withTiming(-3, { duration: 30 }),
                        withTiming(2, { duration: 50 }),
                        withTiming(-1, { duration: 20 }),
                        withTiming(0, { duration: 1500 }),
                        withTiming(5, { duration: 30 }),
                        withTiming(-4, { duration: 40 }),
                        withTiming(0, { duration: 2500 })
                    ),
                    -1, true
                );

                glitchY.value = withRepeat(
                    withSequence(
                        withTiming(0, { duration: 40 }),
                        withTiming(1, { duration: 30 }),
                        withTiming(-1, { duration: 50 }),
                        withTiming(0, { duration: 4000 })
                    ),
                    -1, true
                );

                glitchOpacity.value = withRepeat(
                    withSequence(
                        withTiming(1, { duration: 80 }),
                        withTiming(0.4, { duration: 30 }),
                        withTiming(1, { duration: 100 }),
                        withTiming(1, { duration: 3000 })
                    ),
                    -1, true
                );
            }
            else if (animationType === 'pulse') {
                pulseAnim.value = withRepeat(
                    withTiming(1, { duration: 2000 }),
                    -1, true
                );
            }
        }, 100);

        return () => clearTimeout(timer);
    }, [isAnimated, animationType, progress, glitchX, glitchY, glitchOpacity, pulseAnim]);

    const sweepStyle = useAnimatedStyle(() => {
        const translationRange = textDimensions.width > 0 ? textDimensions.width * 1.5 : 300;
        return {
            transform: [{ translateX: interpolate(progress.value, [0, 1], [-translationRange, translationRange]) }]
        };
    });

    const glitchStyleRed = useAnimatedStyle(() => ({
        opacity: glitchOpacity.value,
        transform: [
            { translateX: glitchX.value },
            { translateY: glitchY.value }
        ]
    }));

    const glitchStyleCyan = useAnimatedStyle(() => ({
        opacity: glitchOpacity.value,
        transform: [
            { translateX: -glitchX.value },
            { translateY: -glitchY.value }
        ]
    }));

    const pulseStyle = useAnimatedStyle(() => ({
        opacity: interpolate(pulseAnim.value, [0, 1], [0.65, 1]),
        textShadowRadius: interpolate(pulseAnim.value, [0, 1], [3, 12])
    }));

    // ⚡️ FIXED: Added numberOfLines={1} so it never wraps, and fixed styles
    const BaseText = ({ styleOverride, onLayout, forceNoShadow }) => (
        <Text
            numberOfLines={1}
            onLayout={onLayout}
            style={[
                {
                    fontSize: fontSize,
                    lineHeight: fontSize * 1.2,
                    textShadowColor: (forceNoShadow || !hasGlow) ? 'transparent' : themeColor,
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: (forceNoShadow || !hasGlow) ? 0 : 8,
                    color: hasGlow ? themeColor : (isDark ? 'white' : '#111827'),
                },
                styleOverride
            ]}
            className="font-black tracking-widest uppercase"
        >
            {username}
        </Text>
    );

    const shouldAnimateNow = isAnimated && hasGlow && isReadyToAnimate && textDimensions.width > 0;

    // ⚡️ FIXED: Measurement layout logic
    if (!shouldAnimateNow) {
        return (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}>
                <View>
                    <BaseText
                        forceNoShadow={!hasGlow}
                        onLayout={(e) => {
                            if (textDimensions.width === 0) {
                                setTextDimensions({
                                    // Math.ceil rounds up, and +10 gives buffer for text shadow and custom fonts!
                                    width: Math.ceil(e.nativeEvent.layout.width) + 10,
                                    height: Math.ceil(e.nativeEvent.layout.height) + 4
                                });
                            }
                        }}
                    />
                </View>

                {(showPeakBadge && peakLevel > 0) && (
                    <View className="ml-1">
                        <PeakBadge level={peakLevel} size={badgeSize} />
                    </View>
                )}
                {showFlame && (
                    <View className="flex-row items-center bg-orange-500/10 px-2.5 py-1 rounded-lg">
                        <Ionicons name="flame" size={flameIconSize} color="#f97316" />
                        <Text className="text-orange-500 font-black ml-1" style={{ fontSize: flameIconSize - 4 }}>{lastStreak}</Text>
                    </View>
                )}
            </View>
        );
    }

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start' }}>

            {/* ⚡️ ANIMATION: SWEEP */}
            {animationType === 'sweep' && (
                <MaskedView
                    style={{ height: textDimensions.height, width: textDimensions.width }}
                    maskElement={
                        <View style={{ flex: 1, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'flex-start' }}>
                            <BaseText styleOverride={{ color: 'white', textShadowRadius: 0 }} />
                        </View>
                    }
                >
                    <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'flex-start' }]}>
                        <BaseText />
                    </View>

                    <Animated.View style={[StyleSheet.absoluteFill, sweepStyle, { width: '200%' }]}>
                        <LinearGradient
                            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.8)', 'rgba(255,255,255,0)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{ flex: 1 }}
                        />
                    </Animated.View>
                </MaskedView>
            )}

            {/* ⚡️ FIXED ANIMATION: GLITCH (Stacking & Layout) */}
            {animationType === 'glitch' && (
                <View style={{ position: 'relative', height: textDimensions.height, width: textDimensions.width }}>

                    {/* Ghost Cyan */}
                    <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, zIndex: 1, justifyContent: 'center' }, glitchStyleCyan]}>
                        <BaseText styleOverride={{ color: '#0ff', opacity: 0.6, textShadowRadius: 0 }} />
                    </Animated.View>

                    {/* Ghost Red */}
                    <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, zIndex: 2, justifyContent: 'center' }, glitchStyleRed]}>
                        <BaseText styleOverride={{ color: '#f00', opacity: 0.6, textShadowRadius: 0 }} />
                    </Animated.View>

                    {/* Solid Base */}
                    <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, zIndex: 3, justifyContent: 'center' }}>
                        <BaseText />
                    </View>

                </View>
            )}

            {/* ⚡️ ANIMATION: PULSE */}
            {animationType === 'pulse' && (
                <Animated.View style={[pulseStyle, { height: textDimensions.height, width: textDimensions.width, justifyContent: 'center' }]}>
                    <BaseText />
                </Animated.View>
            )}

            {(showPeakBadge && peakLevel > 0) && (
                <View className="ml-1">
                    <PeakBadge level={peakLevel} size={badgeSize} />
                </View>
            )}

            {showFlame && (
                <View className="flex-row items-center bg-orange-500/10 px-2.5 py-1 rounded-lg mt-1">
                    <Ionicons name="flame" size={flameIconSize} color="#f97316" />
                    <Text className="text-orange-500 font-black ml-1" style={{ fontSize: flameIconSize - 4 }}>{lastStreak}</Text>
                </View>
            )}

        </View>
    );
}