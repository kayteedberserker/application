import { Canvas, Group, Skia, Skottie } from "@shopify/react-native-skia";
import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import Animated, {
    Easing,
    interpolate,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withRepeat,
    withTiming
} from "react-native-reanimated";
import { SvgXml } from "react-native-svg";
import { Text } from "./Text";

// --- CUSTOM HOOK: Fetch remote Lottie JSON and convert to Skia Skottie animation ---
function useRemoteSkottie(url) {
    const [animation, setAnimation] = useState(null);

    useEffect(() => {
        if (!url) {
            setAnimation(null);
            return;
        }

        let isMounted = true;
        fetch(url)
            .then(res => res.text())
            .then(text => {
                if (isMounted) {
                    try {
                        const anim = Skia.Skottie.Make(text);
                        setAnimation(anim);
                    } catch (e) {
                        console.warn("Failed to parse Lottie JSON for Skia:", e);
                    }
                }
            })
            .catch(err => {
                console.warn("Failed to load Lottie URL into Skia:", err);
            });

        return () => { isMounted = false; };
    }, [url]);

    return animation;
}

// --- CUSTOM HOOK: Drive the Skottie frame with Reanimated ---
function useSkottieProgress(animation, isFeed) {
    const progress = useSharedValue(0);

    useEffect(() => {
        if (animation && !isFeed) {
            // duration is in seconds, convert to ms for withTiming
            const durationMs = animation.duration() * 1000;
            progress.value = 0;
            progress.value = withRepeat(
                withTiming(1, { duration: durationMs, easing: Easing.linear }),
                -1,
                false
            );
        } else {
            progress.value = 0; // Pause at frame 0 for feeds
        }
    }, [animation, isFeed, progress]);

    const frame = useDerivedValue(() => {
        if (!animation) return 0;
        // Skia requires the exact frame number to render
        return progress.value * animation.duration() * animation.fps();
    });

    return frame;
}

export default function AuraAvatar({
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

        if (isFeed) {
            pulseAnim.value = 1;
            floatAnim.value = 0;
            rotateCW.value = 0;
            rotateCCW.value = 360;
            return;
        }

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
    const sizeRatio = size / 44;
    const containerSize = size + (24 * sizeRatio);
    const vfxBaseDim = size * 1.5;
    const vfxWidth = vfxBaseDim * 1.3; // Default buffer width for Skottie bounds
    const vfxHeight = vfxBaseDim * 1.3;
    const offsetY = (equippedVfx?.visualConfig?.offsetY || 0) * sizeRatio;

    // --- SKIA SKOTTIE FETCHING & PROGRESS ---
    const vfxAnim = useRemoteSkottie(vfxUrl);
    const vfxFrame = useSkottieProgress(vfxAnim, isFeed);

    const mainAvatarAnim = useRemoteSkottie(animatedAvatarUrl);
    const mainAvatarFrame = useSkottieProgress(mainAvatarAnim, isFeed);

    // --- CALCULATE SKIA LAYOUT/SCALING ---
    // 1. Scale math for VFX ("contain" equivalent)
    const vfxAnimSize = vfxAnim?.size();
    const vfxScaleX = vfxAnimSize ? vfxWidth / vfxAnimSize.width : 1;
    const vfxScaleY = vfxAnimSize ? vfxHeight / vfxAnimSize.height : 1;
    const vfxBaseScale = Math.min(vfxScaleX, vfxScaleY);
    const vfxFinalScale = vfxBaseScale * (equippedVfx?.visualConfig?.zoom || 1);
    const vfxTransX = vfxAnimSize ? (vfxWidth - vfxAnimSize.width * vfxFinalScale) / 2 : 0;
    const vfxTransY = vfxAnimSize ? (vfxHeight - vfxAnimSize.height * vfxFinalScale) / 2 : 0;

    // 2. Scale math for Avatar ("cover" equivalent)
    const avatarAnimSize = mainAvatarAnim?.size();
    const avatarScaleX = avatarAnimSize ? size / avatarAnimSize.width : 1;
    const avatarScaleY = avatarAnimSize ? size / avatarAnimSize.height : 1;
    const avatarScale = Math.max(avatarScaleX, avatarScaleY);
    const avatarTransX = avatarAnimSize ? (size - avatarAnimSize.width * avatarScale) / 2 : 0;
    const avatarTransY = avatarAnimSize ? (size - avatarAnimSize.height * avatarScale) / 2 : 0;
    const isRank1 = rank === 1;
    const finalAvatarScale = avatarScale * (isRank1 ? 1.4 : 1);
    const finalAvatarRot = isRank1 ? -Math.PI / 4 : 0; // -45deg in radians for Skia

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

            {/* ⚡️ FIXED: SKIA SKOTTIE VFX LAYER */}
            {vfxUrl && (
                <View
                    style={{
                        position: 'absolute',
                        width: vfxWidth,
                        height: vfxHeight,
                        top: (containerSize - vfxHeight) / 2 + offsetY,
                        left: (containerSize - vfxWidth) / 2,
                        zIndex: 1,
                        pointerEvents: 'none',
                        overflow: 'visible'
                    }}
                >
                    {vfxAnim ? (
                        <Canvas style={{ width: vfxWidth, height: vfxHeight }}>
                            <Group transform={[
                                { translateX: vfxTransX },
                                { translateY: vfxTransY },
                                { scale: vfxFinalScale }
                            ]}>
                                <Skottie animation={vfxAnim} frame={vfxFrame} />
                            </Group>
                        </Canvas>
                    ) : (
                        <View className="absolute inset-0 items-center justify-center">
                            <ActivityIndicator size="small" color={displayColor} />
                        </View>
                    )}
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
                {/* ⚡️ CHECK 1: Is it an Animated Lottie Avatar? (Powered by Skia) */}
                {animatedAvatarUrl ? (
                    mainAvatarAnim ? (
                        <Canvas style={{ width: size, height: size }}>
                            <Group origin={{ x: size / 2, y: size / 2 }} transform={[{ rotate: finalAvatarRot }]}>
                                <Group transform={[
                                    { translateX: avatarTransX },
                                    { translateY: avatarTransY },
                                    { scale: finalAvatarScale }
                                ]}>
                                    <Skottie animation={mainAvatarAnim} frame={mainAvatarFrame} />
                                </Group>
                            </Group>
                        </Canvas>
                    ) : (
                        <View className="flex-1 items-center justify-center">
                            <ActivityIndicator size="small" color={displayColor} />
                        </View>
                    )
                ) : rawSvgAvatarCode ? (
                    <View
                        style={[
                            { flex: 1, alignItems: 'center', justifyContent: 'center' },
                            rank === 1 ? { transform: [{ rotate: '-45deg' }], scale: 1.4 } : {}
                        ]}
                    >
                        <SvgXml
                            width="100%"
                            height="100%"
                            xml={rawSvgAvatarCode.replace(/currentColor/g, isDark ? 'white' : 'black')}
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
}