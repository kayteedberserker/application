import { Image } from 'expo-image';
import LottieView from 'lottie-react-native';
import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native'; // ⚡️ ADDED: Image
import Animated, {
    Easing,
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop, SvgXml } from "react-native-svg";

const PlayerBackground = React.memo(({ equippedBg, themeColor, borderRadius = 48, isFeed = false, isCover }) => {
    const lottieRef = useRef(null);
    const bgVisual = equippedBg?.visualConfig || equippedBg?.visualData || {};

    const primary = bgVisual.primaryColor || themeColor || '#22c55e';
    const secondary = bgVisual.secondaryColor || primary;

    const bgOpacity = bgVisual.opacity !== undefined ? bgVisual.opacity : 0.6;
    const animationType = bgVisual.animationType || 'none';

    // ⚡️ IMAGE SUPPORT: Check for static image/webp URL
    const imageUrl = equippedBg?.url || bgVisual.imageUrl;

    // ⚡️ PERFORMANCE: Memoize Lottie source to prevent re-initialization
    const lottieSource = useMemo(() =>
        bgVisual.lottieJson ? bgVisual.lottieJson : { uri: bgVisual.lottieUrl },
        [bgVisual.lottieJson, bgVisual.lottieUrl]
    );

    const hasLottie = !!(bgVisual.lottieUrl || bgVisual.lottieJson);

    // ⚡️ PERFORMANCE: Memoize SVG string replacement
    const processedSvg = useMemo(() => {
        if (!bgVisual.svgCode) return null;
        return bgVisual.svgCode.replace(/currentColor/g, primary);
    }, [bgVisual.svgCode, primary]);

    // --- REANIMATED VALUES ---
    const pulseAnim = useSharedValue(1);
    const sweepAnim = useSharedValue(0);

    useEffect(() => {
        // Clear previous animations to keep the UI thread clean
        cancelAnimation(pulseAnim);
        cancelAnimation(sweepAnim);

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
                -1, false
            );
        }

        return () => {
            cancelAnimation(pulseAnim);
            cancelAnimation(sweepAnim);
        };
    }, [animationType, isFeed]);

    // --- ANIMATED STYLES ---
    const animatedBgStyle = useAnimatedStyle(() => {
        if (animationType === 'pulse') return { transform: [{ scale: pulseAnim.value }] };
        return {};
    });

    const sweepStyle = useAnimatedStyle(() => {
        return {
            left: `${(sweepAnim.value * 300) - 100}%`
        };
    });

    return (
        <View style={[{ borderRadius, overflow: 'hidden' }, StyleSheet.absoluteFillObject]}>
            {/* Ambient Background Glow */}
            <View
                pointerEvents="none"
                className="absolute -top-10 -right-10 w-72 h-72 opacity-10 rounded-full blur-3xl"
                style={{ backgroundColor: primary }}
            />

            {/* MAIN BACKGROUND LAYER */}
            <Animated.View style={[StyleSheet.absoluteFillObject, animatedBgStyle]}>
                {/* 1. STATIC IMAGE (WebP/Cloudinary) - Highest Priority */}
                {imageUrl ? (
                    <Image
                        source={{ uri: imageUrl }}
                        style={[StyleSheet.absoluteFillObject, { opacity: bgOpacity }]}
                        resizeMode="cover"
                    />
                ) : null}

                {/* 2. LOTTIE ANIMATION */}
                {hasLottie ? (
                    <LottieView
                        ref={lottieRef}
                        source={lottieSource}
                        autoPlay={!isFeed}
                        loop={!isFeed}
                        style={[StyleSheet.absoluteFillObject]}
                        resizeMode="cover"
                        renderMode="hardware"
                        colorFilters={[{ keypath: "**", color: primary }]}
                    />

                    /* 3. CUSTOM SVG DESIGNS */
                ) : processedSvg ? (
                    <View style={[StyleSheet.absoluteFillObject, { opacity: bgOpacity }]}>
                        <SvgXml
                            xml={processedSvg}
                            width="100%"
                            height="100%"
                            preserveAspectRatio="xMidYMid slice"
                        />
                    </View>

                    /* 4. FALLBACK GRADIENT (Only if no Image, Lottie, or SVG) */
                ) : !imageUrl && (
                    <View style={[StyleSheet.absoluteFillObject, { opacity: bgOpacity }]}>
                        <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject}>
                            <Defs>
                                <LinearGradient id="playerCardGrad" x1="0%" y1="0%" x2="100%">
                                    <Stop offset="0%" stopColor={primary} stopOpacity={0.15} />
                                    <Stop offset="100%" stopColor={secondary} stopOpacity={0.02} />
                                </LinearGradient>
                            </Defs>
                            <Rect x="0" y="0" width="100%" height="100%" fill="url(#playerCardGrad)" />
                        </Svg>
                    </View>
                )}
            </Animated.View>

            {/* ⚡️ THE SWEEP OVERLAY */}
            {animationType === 'sweep' && (
                <Animated.View
                    pointerEvents="none"
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
});

PlayerBackground.displayName = 'PlayerBackground';

export default PlayerBackground;