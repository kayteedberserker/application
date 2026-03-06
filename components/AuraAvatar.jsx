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
    glowColor = null // 🔹 Added glowColor prop
}) {
    const [imageLoading, setImageLoading] = useState(true);
    // console.log(glowColor);
    
    // Use glowColor if provided, otherwise fallback to aura rank color
    const displayColor = glowColor || aura?.color || '#3b82f6';
    
    // 🔹 REANIMATED SHARED VALUES
    const pulseAnim = useSharedValue(1);
    const rotationAnim = useSharedValue(0);
    const floatAnim = useSharedValue(0);

    // 🔹 PRE-CALCULATE STATIC STYLES
    const frameStyle = useMemo(() => {
        const rank = author?.rank;
        const base = {
            borderRadius: size / 2,
            borderWidth: 1.5,
        };

        // Rank 1: Diamond/Rhombus
        if (rank === 1) {
            return { 
                borderRadius: size * 0.25, 
                transform: [{ rotate: '45deg' }], 
                borderWidth: 2.5 
            };
        }
        // Rank 2: Hexagon-ish (Squircle)
        if (rank === 2) {
            return { ...base, borderRadius: size * 0.45, borderWidth: 2 };
        }
        // Rank 3: Triangle-ish (Teardrop)
        if (rank === 3) {
            return { ...base, borderTopLeftRadius: 2, borderRadius: size * 0.6 };
        }
        // Ranks 4-10: Standard Circle but with elevated styling
        return { ...base, borderRadius: size };
    }, [author?.rank, size]);

    useEffect(() => {
        // Shared pulse for everyone in Top 10 OR if a special glow is active
        if (isTop10 || glowColor) {
            pulseAnim.value = withRepeat(
                withTiming(1.08, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
                -1, 
                true 
            );

            // Floating effect for lower ranks (4-10) or special glowers to make them feel "alive"
            if (author?.rank > 3 || glowColor) {
                floatAnim.value = withRepeat(
                    withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
                    -1,
                    true
                );
            }
        }

        // Fast rotation only for Elite Top 5 or special glowers
        if ((isTop10 && author?.rank <= 5) || glowColor) {
            rotationAnim.value = withRepeat(
                withTiming(360, { duration: 8000, easing: Easing.linear }),
                -1,
                false 
            );
        }
    }, [isTop10, author?.rank, glowColor]);

    // 🔹 ANIMATED STYLES
    const animatedSpinStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { rotate: author?.rank === 1 ? '45deg' : '0deg' },
                { rotate: `${rotationAnim.value}deg` }
            ]
        };
    });

    const animatedAuraStyle = useAnimatedStyle(() => {
        const translateY = interpolate(floatAnim.value, [0, 1], [0, -4]);
        return {
            transform: [
                { rotate: author?.rank === 1 ? '45deg' : '0deg' },
                { scale: pulseAnim.value },
                { translateY: (author?.rank > 3 || glowColor) ? translateY : 0 }
            ],
            // Dynamic shadow glow using the displayColor
            shadowColor: displayColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: interpolate(pulseAnim.value, [1, 1.08], [0.2, 0.8]),
            shadowRadius: interpolate(pulseAnim.value, [1, 1.08], [4, 15]),
        };
    });

    const containerSize = size + 16;

    return (
        <Pressable
            onPress={onPress}
            style={{ width: containerSize, height: containerSize }}
            className="relative shrink-0 items-center justify-center"
        >
            {/* Layer 1: Enhanced Spinning Orbit (Top 5 or special glow) */}
            {( (isTop10 && author?.rank <= 5) || glowColor ) && (
                <Animated.View
                    style={[
                        frameStyle,
                        animatedSpinStyle,
                        {
                            position: 'absolute',
                            width: size + 14,
                            height: size + 14,
                            borderColor: displayColor,
                            borderStyle: 'dashed',
                            borderWidth: 1.2,
                            opacity: 0.6,
                        }
                    ]}
                />
            )}

            {/* Layer 2: The Breathing Aura Glow */}
            {(isTop10 || glowColor) && (
                <Animated.View
                    style={[
                        frameStyle,
                        animatedAuraStyle,
                        {
                            position: 'absolute',
                            width: size + 4,
                            height: size + 4,
                            backgroundColor: (author?.rank > 3 || glowColor) ? 'transparent' : displayColor,
                            borderColor: displayColor,
                            borderWidth: (author?.rank > 3 || glowColor) ? 2 : 0,
                            opacity: (author?.rank > 3 || glowColor) ? 0.5 : 0.25,
                        }
                    ]}
                />
            )}

            {/* Layer 3: The Actual Avatar Image */}
            <Animated.View 
                style={[
                    frameStyle, 
                    (author?.rank > 3 || glowColor) ? animatedAuraStyle : {}, 
                    { 
                        width: size, 
                        height: size, 
                        borderColor: (isTop10 || glowColor) ? displayColor : 'rgba(156, 163, 175, 0.3)', 
                        overflow: 'hidden', 
                        backgroundColor: isDark ? '#111' : '#f3f4f6',
                        zIndex: 2,
                        elevation: (isTop10 || glowColor) ? 8 : 0
                    }
                ]}
            >
                {author?.image ? (
                    <>
                        <Image
                            source={{ uri: author.image }}
                            className="w-full h-full"
                            resizeMode="cover"
                            onLoadEnd={() => setImageLoading(false)}
                            style={author.rank === 1 ? { transform: [{ rotate: '-45deg' }], scale: 1.4 } : {}}
                        />
                        {imageLoading && (
                            <View className="absolute inset-0 items-center justify-center bg-gray-100 dark:bg-gray-900">
                                <ActivityIndicator size="small" color={displayColor} />
                            </View>
                        )}
                    </>
                ) : (
                    <View className="flex-1 items-center justify-center" style={{ backgroundColor: (isTop10 || glowColor) ? displayColor : '#64748b' }}>
                        <Text 
                            style={author.rank === 1 ? { transform: [{ rotate: '-45deg' }] } : {}}
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