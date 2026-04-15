import LottieView from 'lottie-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop, SvgXml } from "react-native-svg";

export default function PlayerBackground({ equippedBg, themeColor, borderRadius = 48, isFeed = false }) {
    const bgVisual = equippedBg?.visualConfig || equippedBg?.visualData || {};

    const primary = bgVisual.primaryColor || themeColor || '#22c55e';
    const secondary = bgVisual.secondaryColor || primary;

    // ⚡️ 1. Dynamic Opacity (Defaults to 0.6 if server doesn't send one)
    const bgOpacity = bgVisual.opacity !== undefined ? bgVisual.opacity : 0.6;

    // ⚡️ 2. Dynamic Native Animation Type
    const animationType = bgVisual.animationType || 'none';

    const lottieSource = bgVisual.lottieJson ? bgVisual.lottieJson : { uri: bgVisual.lottieUrl };
    const hasLottie = !!(bgVisual.lottieUrl || bgVisual.lottieJson);

    // --- REANIMATED VALUES ---
    const pulseAnim = useSharedValue(1);
    const sweepAnim = useSharedValue(0);

    useEffect(() => {
        if (isFeed) {
            pulseAnim.value = 1;
            sweepAnim.value = 0.5;
            return;
        }

        if (animationType === 'pulse') {
            pulseAnim.value = withRepeat(
                withSequence(
                    withTiming(1.1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
                    withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
                ),
                -1, true
            );
        } else if (animationType === 'sweep') {
            sweepAnim.value = withRepeat(
                withTiming(1, { duration: 3000, easing: Easing.linear }),
                -1, false // false = restart from beginning instead of reversing
            );
        }
    }, [animationType, isFeed]);

    // --- ANIMATED STYLES ---
    const animatedBgStyle = useAnimatedStyle(() => {
        if (animationType === 'pulse') return { transform: [{ scale: pulseAnim.value }] };
        return {};
    });

    const sweepStyle = useAnimatedStyle(() => {
        // Moves from -100% (left) to 200% (right)
        return {
            left: `${(sweepAnim.value * 300) - 100}%`
        };
    });

    return (
        <View style={[{ borderRadius, overflow: 'hidden' }, StyleSheet.absoluteFillObject]}>
            {/* Ambient Background Glow */}
            <View
                className="absolute -top-10 -right-10 w-72 h-72 opacity-10 rounded-full blur-3xl"
                style={{ backgroundColor: primary }}
            />

            {/* MAIN BACKGROUND LAYER (Wrapped in Animated.View for Pulse) */}
            <Animated.View style={[StyleSheet.absoluteFillObject, animatedBgStyle]}>
                {/* 1. LOTTIE ANIMATION */}
                {hasLottie ? (
                    <LottieView
                        source={lottieSource}
                        autoPlay={!isFeed}
                        loop={!isFeed}
                        style={[StyleSheet.absoluteFillObject]}
                        resizeMode="cover"
                        renderMode="hardware"
                        colorFilters={[{ keypath: "**", color: primary }]}
                    />

                    /* 2. CUSTOM SVG DESIGNS */
                ) : bgVisual.svgCode ? (
                    // ⚡️ Applies your backend opacity here!
                    <View style={[StyleSheet.absoluteFillObject, { opacity: bgOpacity }]}>
                        <SvgXml
                            xml={bgVisual.svgCode.replace(/currentColor/g, primary)}
                            width="100%"
                            height="100%"
                            preserveAspectRatio="xMidYMid slice"
                        />
                    </View>

                    /* 3. FALLBACK GRADIENT */
                ) : (
                    // ⚡️ Applies your backend opacity here too!
                    <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: bgOpacity }]}>
                        <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject}>
                            <Defs>
                                <LinearGradient id="playerCardGrad" x1="0%" y1="0%" x2="100%">
                                    <Stop offset="0%" stopColor={primary} stopOpacity={0.15} />
                                    <Stop offset="100%" stopColor={secondary} stopOpacity={0.02} />
                                </LinearGradient>
                            </Defs>
                            <Rect x="0" y="0" width="100%" height="100%" fill="url(#playerCardGrad)" />
                        </Svg>
                    </Animated.View>
                )}
            </Animated.View>

            {/* ⚡️ THE SWEEP OVERLAY (Only renders if animationType is 'sweep') */}
            {animationType === 'sweep' && (
                <Animated.View
                    style={[
                        sweepStyle,
                        { position: 'absolute', top: 0, bottom: 0, width: '50%', opacity: 0.3 }
                    ]}
                >
                    <Svg height="100%" width="100%">
                        <Defs>
                            <LinearGradient id="sweepGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                <Stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                                <Stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
                                <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                            </LinearGradient>
                        </Defs>
                        <Rect x="0" y="0" width="100%" height="100%" fill="url(#sweepGrad)" transform="skewX(-20)" />
                    </Svg>
                </Animated.View>
            )}
        </View>
    );
}