import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import Animated, {
    Easing,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming
} from "react-native-reanimated";
import { Text } from "./Text";

export default function AuraAvatar({ 
    author, 
    aura, 
    isTop10, 
    isDark, 
    onPress, 
    size = 44,
    glowColor = null 
}) {
    const [imageLoading, setImageLoading] = useState(true);
    
    // 🔹 Fallback to Aura color if no special glow is equipped
    const displayColor = glowColor || aura?.color || '#3b82f6';
    const rank = author?.rank || 100;
    const hasPremiumAura = isTop10 || glowColor;
    
    // 🔹 REANIMATED SHARED VALUES
    const pulseAnim = useSharedValue(1);
    const floatAnim = useSharedValue(0);
    const rotateCW = useSharedValue(0);
    const rotateCCW = useSharedValue(360);

    // 🔹 STATIC SHAPES BASED ON RANK
    const frameStyle = useMemo(() => {
        const base = { borderRadius: size / 2, borderWidth: 1.5 };
        if (rank === 1) return { borderRadius: size * 0.25, transform: [{ rotate: '45deg' }], borderWidth: 2.5 };
        if (rank === 2) return { ...base, borderRadius: size * 0.45, borderWidth: 2 };
        if (rank === 3) return { ...base, borderTopLeftRadius: 2, borderRadius: size * 0.6 };
        return { ...base, borderRadius: size };
    }, [rank, size]);

    // 🔹 TIERED ANIMATION CONTROLLER
    useEffect(() => {
        if (!hasPremiumAura) return;

        // 1. Pulsing Fire/Heat effect (Faster for higher ranks)
        const pulseSpeed = rank === 1 ? 800 : rank <= 3 ? 1200 : rank <= 5 || glowColor ? 1500 : 2000;
        pulseAnim.value = withRepeat(
            withTiming(1.15, { duration: pulseSpeed, easing: Easing.inOut(Easing.ease) }),
            -1, true 
        );

        // 2. Levitation/Float
        floatAnim.value = withRepeat(
            withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
            -1, true
        );

        // 3. Orbits (Rings spinning)
        rotateCW.value = withRepeat(
            withTiming(360, { duration: rank === 1 ? 3000 : 5000, easing: Easing.linear }),
            -1, false 
        );
        rotateCCW.value = withRepeat(
            withTiming(0, { duration: rank === 1 ? 4000 : 6000, easing: Easing.linear }),
            -1, false 
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasPremiumAura, rank, glowColor]);

    // 🔹 STYLES: THE BREATHING FIRE AURA
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

    // 🔹 STYLES: THE ORBITING RINGS
    const cwRingStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotateCW.value}deg` }] }));
    const ccwRingStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotateCCW.value}deg` }] }));
    const fadeRingStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotateCW.value}deg` }],
        opacity: interpolate(pulseAnim.value, [1, 1.15], [0.1, 0.6])
    }));

    const containerSize = size + 16; 

    return (
        <Pressable
            onPress={onPress}
            style={{ width: containerSize, height: containerSize }}
            className="relative shrink-0 items-center justify-center"
        >
            {hasPremiumAura && (
                <>
                    {/* 🔥 THE FIRE GLOW (Applies to everyone in Top 10 / Store) */}
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

                    {/* 👑 RANK 1: DOUBLE DASHED RINGS */}
                    {rank === 1 && (
                        <>
                            <Animated.View style={[cwRingStyle, { position: 'absolute', width: size + 14, height: size + 14, borderRadius: 100, borderWidth: 1.5, borderColor: displayColor, borderStyle: 'dashed', opacity: 0.8 }]} />
                            <Animated.View style={[ccwRingStyle, { position: 'absolute', width: size + 22, height: size + 22, borderRadius: 100, borderWidth: 1, borderColor: displayColor, borderStyle: 'dotted', opacity: 0.4 }]} />
                        </>
                    )}

                    {/* 🔥 RANK 2-3: SINGLE FAST DASHED RING */}
                    {(rank === 2 || rank === 3) && (
                        <Animated.View style={[cwRingStyle, { position: 'absolute', width: size + 12, height: size + 12, borderRadius: 100, borderWidth: 1.5, borderColor: displayColor, borderStyle: 'dashed', opacity: 0.6 }]} />
                    )}

                    {/* ☄️ RANK 4-5 OR STORE GLOW: DOUBLE DOTTED RINGS */}
                    {((rank === 4 || rank === 5) || glowColor) && (
                        <>
                            <Animated.View style={[cwRingStyle, { position: 'absolute', width: size + 10, height: size + 10, borderRadius: 100, borderWidth: 1, borderColor: displayColor, borderStyle: 'dotted', opacity: 0.7 }]} />
                            <Animated.View style={[ccwRingStyle, { position: 'absolute', width: size + 16, height: size + 16, borderRadius: 100, borderWidth: 1, borderColor: displayColor, borderStyle: 'dotted', opacity: 0.3 }]} />
                        </>
                    )}

                    {/* ✨ RANK 6-10: SINGLE FADING SOLID RING */}
                    {(rank >= 6 && rank <= 10 && !glowColor) && (
                        <Animated.View style={[fadeRingStyle, { position: 'absolute', width: size + 8, height: size + 8, borderRadius: 100, borderWidth: 1, borderColor: displayColor }]} />
                    )}
                </>
            )}

            {/* 👤 THE AVATAR IMAGE */}
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
                {author?.image ? (
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