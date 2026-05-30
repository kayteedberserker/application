import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient'; // ⚡️ ADDED: Native Expo Gradient Support
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
import { SvgXml } from "react-native-svg"; // ⚡️ OPTIMIZED: Kept only SvgXml to handle custom strings safely

// Helper utility to safely inject opacity into hex colors for expo-linear-gradient stops
const hexToRgba = (hex, alpha) => {
    if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return hex;
    let color = hex.substring(1);
    if (color.length === 3) {
        color = color.split('').map(char => char + char).join('');
    }
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const PlayerBackground = React.memo(({ equippedBg, themeColor, borderRadius = 48, isFeed = false, isCover, isVisible = false }) => {
    const lottieRef = useRef(null);
    const bgVisual = equippedBg?.visualConfig || equippedBg?.visualData || {};

    const primary = bgVisual.primaryColor || themeColor || '#22c55e';
    const secondary = bgVisual.secondaryColor || primary;

    const bgOpacity = bgVisual.opacity !== undefined ? bgVisual.opacity : 0.6;
    const animationType = bgVisual.animationType || 'none';

    // ⚡️ IMAGE SUPPORT: Check for static image/webp URL
    const imageUrl = equippedBg?.url || bgVisual.imageUrl;

    // Determine animation rule: only kill animation when it IS in the feed AND NOT visible.
    const shouldAnimate = !isFeed || isVisible;

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

        // Render static version only if in feed view and the component isn't visible
        if (!shouldAnimate) {
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
    }, [animationType, shouldAnimate]);

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
        <View style={[{ borderRadius, overflow: 'hidden' }, StyleSheet.absoluteFill]}>
            {/* Ambient Background Glow */}
            <View
                pointerEvents="none"
                className="absolute -top-10 -right-10 w-72 h-72 opacity-10 rounded-full blur-3xl"
                style={{ backgroundColor: primary }}
            />

            {/* MAIN BACKGROUND LAYER */}
            <Animated.View style={[StyleSheet.absoluteFill, animatedBgStyle]}>
                {/* 1. STATIC IMAGE (WebP/Cloudinary) - Highest Priority */}
                {imageUrl ? (
                    <Image
                        source={{ uri: imageUrl }}
                        style={[StyleSheet.absoluteFill, { opacity: bgOpacity }]}
                        contentFit="cover"
                    />
                ) : null}

                {/* 2. LOTTIE ANIMATION */}
                {hasLottie ? (
                    <LottieView
                        ref={lottieRef}
                        source={lottieSource}
                        autoPlay={shouldAnimate}
                        loop={shouldAnimate}
                        style={[StyleSheet.absoluteFill]}
                        resizeMode="cover"
                        renderMode="hardware"
                        colorFilters={[{ keypath: "**", color: primary }]}
                    />

                    /* 3. CUSTOM SVG DESIGNS */
                ) : processedSvg ? (
                    <View style={[StyleSheet.absoluteFill, { opacity: bgOpacity }]}>
                        <SvgXml
                            xml={processedSvg}
                            width="100%"
                            height="100%"
                            preserveAspectRatio="xMidYMid slice"
                        />
                    </View>

                    /* 4. FALLBACK GRADIENT (Only if no Image, Lottie, or SVG) */
                ) : !imageUrl && (
                    <LinearGradient
                        colors={[hexToRgba(primary, 0.15), hexToRgba(secondary, 0.02)]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[StyleSheet.absoluteFill, { opacity: bgOpacity }]}
                    />
                )}
            </Animated.View>

            {/* ⚡️ THE SWEEP OVERLAY */}
            {animationType === 'sweep' && shouldAnimate && (
                <Animated.View
                    pointerEvents="none"
                    style={[
                        sweepStyle,
                        {
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            width: '50%',
                            opacity: 0.3,
                            transform: [{ skewX: '-20deg' }] // ⚡️ FIXED: Native transformation applied safely via Reanimated container style
                        }
                    ]}
                >
                    <LinearGradient
                        colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 1)', 'rgba(255, 255, 255, 0)']}
                        locations={[0, 0.5, 1]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                    />
                </Animated.View>
            )}
        </View>
    );
});

PlayerBackground.displayName = 'PlayerBackground';

export default PlayerBackground;