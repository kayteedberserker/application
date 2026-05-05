import { Image } from "expo-image";
import LottieView from 'lottie-react-native';
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import Animated, {
    Easing,
    cancelAnimation, // ⚡️ Added to clean up animations
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming
} from "react-native-reanimated";
import { SvgXml } from "react-native-svg";
import { Text } from "./Text";

// ⚡️ PERFORMANCE FIX 1: Wrap the entire component in React.memo
// This stops it from re-rendering in LegendList unless its specific props change.
const AuraAvatar = React.memo(function AuraAvatar({
    author,
    aura,
    isTop10,
    isDark,
    onPress,
    size = 44,
    isFeed = false,
    glowColor = null
}) {
    const [imageLoading, setImageLoading] = useState(true);

    const displayColor = glowColor || aura?.color || '#3b82f6';
    const rank = author?.rank || 100;
    const hasPremiumAura = isTop10 || glowColor;

    // --- CHECK FOR AVATAR VFX (Fire, Lightning, etc.) ---
    const equippedVfx = useMemo(() => {
        return author?.inventory?.find(i => i.category === 'AVATAR_VFX' && i.isEquipped);
    }, [author?.inventory]);

    const vfxUrl = equippedVfx?.visualConfig?.lottieUrl || null;

    // --- CHECK FOR PREMIUM AVATAR (Lottie or SVG) ---
    const equippedAnimatedAvatar = useMemo(() => {
        return author?.inventory?.find(i => i.category === 'AVATAR' && i.isEquipped);
    }, [author?.inventory]);

    const animatedAvatarUrl = equippedAnimatedAvatar?.visualConfig?.lottieUrl || null;
    const rawSvgAvatarCode = equippedAnimatedAvatar?.visualConfig?.svgCode || null;

    // ⚡️ PERFORMANCE FIX 2: Memoize Lottie Sources to prevent object re-creation on scroll
    const vfxSource = useMemo(() => vfxUrl ? { uri: vfxUrl } : null, [vfxUrl]);
    const animatedAvatarSource = useMemo(() => animatedAvatarUrl ? { uri: animatedAvatarUrl } : null, [animatedAvatarUrl]);

    // ⚡️ PERFORMANCE FIX 3: Memoize SVG String parsing
    const processedSvgAvatarCode = useMemo(() => {
        if (!rawSvgAvatarCode) return null;
        return rawSvgAvatarCode.replace(/currentColor/g, isDark ? 'white' : 'black');
    }, [rawSvgAvatarCode, isDark]);

    // --- REANIMATED SHARED VALUES ---
    const pulseAnim = useSharedValue(1);
    const floatAnim = useSharedValue(0);
    const rotateCW = useSharedValue(0);
    const rotateCCW = useSharedValue(360);

    // --- STATIC SHAPES BASED ON RANK ---
    const frameStyle = useMemo(() => {
        const base = { borderRadius: size / 2, borderWidth: 1.5 };
        if (rank === 1) return { borderRadius: size * 0.25, transform: [{ rotate: '45deg' }], borderWidth: 2.5 };
        if (rank === 2) return { ...base, borderRadius: size * 0.45, borderWidth: 2 };
        if (rank === 3) return { ...base, borderTopLeftRadius: 2, borderRadius: size * 0.6 };
        return { ...base, borderRadius: size };
    }, [rank, size]);

    // --- TIERED ANIMATION CONTROLLER ---
    useEffect(() => {
        if (!hasPremiumAura) return;

        // if (isFeed) {
        //     pulseAnim.value = 1;
        //     floatAnim.value = 0;
        //     rotateCW.value = 0;
        //     rotateCCW.value = 360;
        //     return;
        // }

        const pulseSpeed = rank === 1 ? 800 : rank <= 3 ? 1200 : rank <= 5 || glowColor ? 1500 : 2000;
        pulseAnim.value = withRepeat(
            withTiming(1.15, { duration: pulseSpeed, easing: Easing.inOut(Easing.ease) }),
            -1, true
        );

        floatAnim.value = withRepeat(
            withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
            -1, true
        );

        rotateCW.value = withRepeat(
            withTiming(360, { duration: rank === 1 ? 3000 : 5000, easing: Easing.linear }),
            -1, false
        );
        rotateCCW.value = withRepeat(
            withTiming(0, { duration: rank === 1 ? 4000 : 6000, easing: Easing.linear }),
            -1, false
        );

        // ⚡️ PERFORMANCE FIX 4: Cleanup animations on unmount to free up the UI thread
        return () => {
            cancelAnimation(pulseAnim);
            cancelAnimation(floatAnim);
            cancelAnimation(rotateCW);
            cancelAnimation(rotateCCW);
        };
    }, [hasPremiumAura, rank, glowColor, isFeed]);

    // --- STYLES: THE BREATHING FIRE AURA ---
    const fireGlowStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { rotate: rank === 1 ? '45deg' : '0deg' },
                { scale: pulseAnim.value }
            ],
            shadowColor: displayColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: interpolate(pulseAnim.value, [1, 1.15], [0.4, 0.9]),
            shadowRadius: interpolate(pulseAnim.value, [1, 1.15], [5, 12]),
        };
    });

    const floatingAvatarStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { rotate: rank === 1 ? '45deg' : '0deg' },
                { translateY: interpolate(floatAnim.value, [0, 1], [0, -3]) }
            ]
        };
    });

    const cwRingStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotateCW.value}deg` }] }));
    const ccwRingStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotateCCW.value}deg` }] }));
    const fadeRingStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotateCW.value}deg` }],
        opacity: interpolate(pulseAnim.value, [1, 1.15], [0.1, 0.6])
    }));

    // ========================================================
    // ⚡️ FIXED: PROPORTIONAL SCALING MATH FOR VFX
    // ========================================================
    // 1. Calculate ratio based on standard size (44)
    const sizeRatio = size / 44;

    // 2. Container buffer scales proportionally (so rings don't clip on big sizes)
    const containerSize = size + (24 * sizeRatio);

    // 3. Scale VFX safely (Give it a larger base bounding box so Lotties don't clip)
    const vfxScale = equippedVfx?.visualConfig?.zoom || 1.3;
    const vfxBaseDim = size * 1.5;
    const vfxWidth = vfxBaseDim * vfxScale;
    const vfxHeight = vfxBaseDim * vfxScale;

    // 4. Any Y-offsets from the database must also scale relative to the size
    const offsetY = (equippedVfx?.visualConfig?.offsetY || 0) * sizeRatio;

    return (
        <Pressable
            onPress={onPress}
            style={{ width: containerSize, height: containerSize }}
            className="relative shrink-0 items-center justify-center"
        >
            {hasPremiumAura && (
                <>
                    <Animated.View
                        style={[
                            frameStyle,
                            fireGlowStyle,
                            {
                                position: 'absolute',
                                width: size + 2,
                                height: size + 2,
                                backgroundColor: displayColor,
                                opacity: 0.15,
                            }
                        ]}
                    />

                    {rank === 1 && (
                        <>
                            <Animated.View style={[cwRingStyle, { position: 'absolute', width: size + 14, height: size + 14, borderRadius: 100, borderWidth: 1.5, borderColor: displayColor, borderStyle: 'dashed', opacity: 0.8 }]} />
                            <Animated.View style={[ccwRingStyle, { position: 'absolute', width: size + 22, height: size + 22, borderRadius: 100, borderWidth: 1, borderColor: displayColor, borderStyle: 'dotted', opacity: 0.4 }]} />
                        </>
                    )}

                    {(rank === 2 || rank === 3) && (
                        <Animated.View style={[cwRingStyle, { position: 'absolute', width: size + 12, height: size + 12, borderRadius: 100, borderWidth: 1.5, borderColor: displayColor, borderStyle: 'dashed', opacity: 0.6 }]} />
                    )}

                    {((rank === 4 || rank === 5) || glowColor) && (
                        <>
                            <Animated.View style={[cwRingStyle, { position: 'absolute', width: size + 10, height: size + 10, borderRadius: 100, borderWidth: 1, borderColor: displayColor, borderStyle: 'dotted', opacity: 0.7 }]} />
                            <Animated.View style={[ccwRingStyle, { position: 'absolute', width: size + 16, height: size + 16, borderRadius: 100, borderWidth: 1, borderColor: displayColor, borderStyle: 'dotted', opacity: 0.3 }]} />
                        </>
                    )}

                    {(rank >= 6 && rank <= 10 && !glowColor) && (
                        <Animated.View style={[fadeRingStyle, { position: 'absolute', width: size + 8, height: size + 8, borderRadius: 100, borderWidth: 1, borderColor: displayColor }]} />
                    )}
                </>
            )}

            {/* ⚡️ FIXED: PERFECTLY ANCHORED & SCALED LOTTIE VFX LAYER */}
            {vfxSource && (
                <View
                    style={{
                        position: 'absolute',
                        width: vfxWidth,
                        height: vfxHeight,
                        // Mathematically anchors to the exact center of the container, then applies the scaled offset
                        top: (containerSize - vfxHeight) / 2 + offsetY,
                        left: (containerSize - vfxWidth) / 2,
                        zIndex: 1,
                        pointerEvents: 'none',
                        overflow: 'visible' // Prevents the animation from clipping off edges
                    }}
                >
                    <LottieView
                        source={vfxSource}
                        autoPlay={isFeed}
                        loop={isFeed}
                        style={{
                            width: '100%',
                            height: '100%',
                            transform: [{ scale: equippedVfx?.visualConfig?.zoom || 1 }]
                        }}
                        resizeMode="contain"
                        renderMode="hardware"
                        colorFilters={equippedVfx?.visualConfig?.applyThemeColor ? [{ keypath: "**", color: displayColor }] : []}
                    />
                </View>
            )}

            {/* 👤 THE AVATAR IMAGE, LOTTIE, OR SVG */}
            <Animated.View
                style={[
                    frameStyle,
                    hasPremiumAura ? floatingAvatarStyle : {},
                    {
                        width: size,
                        height: size,
                        borderColor: hasPremiumAura ? displayColor : 'rgba(156, 163, 175, 0.3)',
                        overflow: 'hidden',
                        backgroundColor: isDark ? '#111' : '#f3f4f6',
                        zIndex: 2,
                    }
                ]}
            >
                {/* ⚡️ CHECK 1: Is it an Animated Lottie Avatar? */}
                {animatedAvatarSource ? (
                    <LottieView
                        source={animatedAvatarSource}
                        autoPlay={isFeed}
                        loop={isFeed}
                        style={[
                            { width: '100%', height: '100%' },
                            rank === 1 ? { transform: [{ rotate: '-45deg' }], scale: 1.4 } : {}
                        ]}
                        resizeMode="cover"
                        renderMode="hardware"
                    />

                ) : processedSvgAvatarCode ? (
                    <View
                        style={[
                            { flex: 1, alignItems: 'center', justifyContent: 'center' },
                            rank === 1 ? { transform: [{ rotate: '-45deg' }], scale: 1.4 } : {}
                        ]}
                    >
                        <SvgXml
                            width="100%"
                            height="100%"
                            xml={processedSvgAvatarCode}
                        />
                    </View>

                ) : author?.image ? (
                    <>
                        <Image
                            source={{ uri: author.image }}
                            style={[
                                { width: '100%', height: '100%' },
                                rank === 1 ? { transform: [{ rotate: '-45deg' }], scale: 1.4 } : {}
                            ]}
                            contentFit="cover"
                            onLoadEnd={() => setImageLoading(false)}
                            cachePolicy="memory-disk"
                            transition={200}
                        />
                        {imageLoading && (
                            <View className="absolute inset-0 items-center justify-center bg-gray-100 dark:bg-gray-900">
                                <ActivityIndicator size="small" color={displayColor} />
                            </View>
                        )}
                    </>

                ) : (
                    <View className="flex-1 items-center justify-center" style={{ backgroundColor: hasPremiumAura ? displayColor : '#64748b' }}>
                        <Text
                            style={rank === 1 ? { transform: [{ rotate: '-45deg' }] } : {}}
                            className="text-white font-black text-lg"
                        >
                            {author?.name?.charAt(0).toUpperCase() || "?"}
                        </Text>
                    </View>
                )}
            </Animated.View>
        </Pressable>
    );
});

export default AuraAvatar;