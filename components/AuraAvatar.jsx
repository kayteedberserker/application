import React, { useEffect } from "react";
import { Image, Pressable, View } from "react-native";
import Animated, {
    Easing,
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
    size = 44 
}) {
    // 🔹 REANIMATED SHARED VALUES
    const pulseAnim = useSharedValue(1);
    const rotationAnim = useSharedValue(0);

    useEffect(() => {
        if (!isTop10) return; // Only run animations if they are ranked

        // Pulse: Scales to 1.1 over 2.5s, then reverses back to 1 infinitely
        pulseAnim.value = withRepeat(
            withTiming(1.1, { duration: 2500 }),
            -1, 
            true 
        );

        // Rotation: Spins 360 degrees over 10s continuously
        rotationAnim.value = withRepeat(
            withTiming(360, { duration: 10000, easing: Easing.linear }),
            -1,
            false 
        );
    }, [isTop10]);

    const getRankedFrameStyle = () => {
        if (!author?.rank) return { borderRadius: size / 2, borderWidth: 1 };
        if (author.rank === 1) return { borderRadius: size * 0.3, transform: [{ rotate: '45deg' }], borderWidth: 2 };
        if (author.rank === 2) return { borderRadius: size * 0.56, borderWidth: 2 };
        if (author.rank === 3) return { borderRadius: size * 0.18, borderWidth: 1.5 };
        return { borderRadius: size, borderWidth: 1 };
    };

    // 🔹 ANIMATED STYLES
    const animatedSpinStyle = useAnimatedStyle(() => {
        return {
            transform: [
                ...(getRankedFrameStyle().transform || []),
                { rotate: `${rotationAnim.value}deg` }
            ]
        };
    });

    const animatedPulseStyle = useAnimatedStyle(() => {
        return {
            transform: [
                ...(getRankedFrameStyle().transform || []),
                { scale: pulseAnim.value }
            ]
        };
    });

    const containerSize = size + 12; // Gives room for the external spinning borders

    return (
        <Pressable
            onPress={onPress}
            style={{ width: containerSize, height: containerSize }}
            className="relative shrink-0 items-center justify-center"
        >
            {/* Layer 1: Dashed Spinning Border (Top 5 only) */}
            {isTop10 && author.rank <= 5 && (
                <Animated.View
                    style={[
                        getRankedFrameStyle(),
                        animatedSpinStyle,
                        {
                            position: 'absolute',
                            width: size + 12,
                            height: size + 12,
                            borderColor: aura?.color || '#2563eb',
                            borderStyle: 'dashed',
                            opacity: 0.6,
                        }
                    ]}
                />
            )}

            {/* Layer 2: Pulsing Solid Border */}
            {isTop10 && (
                <Animated.View
                    style={[
                        getRankedFrameStyle(),
                        animatedPulseStyle,
                        {
                            position: 'absolute',
                            width: size + 6,
                            height: size + 6,
                            borderColor: aura?.color || '#2563eb',
                            opacity: 0.3,
                        }
                    ]}
                />
            )}

            {/* Layer 3: The Actual Avatar Image/Initials */}
            <View 
                style={[
                    getRankedFrameStyle(), 
                    { 
                        width: size, 
                        height: size, 
                        borderColor: isTop10 ? aura?.color : 'rgba(96, 165, 250, 0.3)', 
                        overflow: 'hidden', 
                        backgroundColor: isDark ? '#1a1d23' : '#f3f4f6' 
                    }
                ]}
            >
                {author?.image ? (
                    <Image
                        source={{ uri: author.image }}
                        className="w-full h-full bg-gray-200"
                        resizeMode="cover"
                        style={author.rank === 1 ? { transform: [{ rotate: '-45deg' }], scale: 1.4 } : {}}
                    />
                ) : (
                    <View className="flex-1 items-center justify-center" style={{ backgroundColor: isTop10 ? aura?.color : '#2563eb' }}>
                        <Text className="text-white font-black">
                            {author?.name?.charAt(0).toUpperCase() || "?"}
                        </Text>
                    </View>
                )}
            </View>

            {/* Layer 4: The Status Dot */}
            <View 
                className="absolute bottom-1 right-1 border-2 border-white dark:border-[#0d1117] rounded-full shadow-sm"
                // Scale dot relative to size
                style={[{ width: size * 0.3, height: size * 0.3, backgroundColor: isTop10 ? aura?.color : '#2563eb' }]} 
            />
        </Pressable>
    );
}
