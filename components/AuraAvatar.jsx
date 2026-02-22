import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming
} from "react-native-reanimated";
import { Text } from "./Text";
import { SyncLoading } from "./SyncLoading"; // 🔹 Added for loading instruction

export default function AuraAvatar({ 
    author, 
    aura, 
    isTop10, 
    isDark, 
    onPress, 
    size = 44 
}) {
    const [imageLoading, setImageLoading] = useState(true);
    
    // 🔹 REANIMATED SHARED VALUES
    const pulseAnim = useSharedValue(1);
    const rotationAnim = useSharedValue(0);

    // 🔹 PRE-CALCULATE STATIC STYLES (Prevents UI Thread Crash)
    const frameStyle = useMemo(() => {
        const rank = author?.rank;
        const base = {
            borderRadius: size / 2,
            borderWidth: 1,
            transform: []
        };

        if (rank === 1) {
            return { 
                borderRadius: size * 0.3, 
                transform: [{ rotate: '45deg' }], 
                borderWidth: 2 
            };
        }
        if (rank === 2) {
            return { ...base, borderRadius: size * 0.56, borderWidth: 2 };
        }
        if (rank === 3) {
            return { ...base, borderRadius: size * 0.18, borderWidth: 1.5 };
        }
        return { ...base, borderRadius: size };
    }, [author?.rank, size]);

    useEffect(() => {
        if (!isTop10) {
            pulseAnim.value = 1;
            rotationAnim.value = 0;
            return;
        }

        pulseAnim.value = withRepeat(
            withTiming(1.1, { duration: 2500 }),
            -1, 
            true 
        );

        rotationAnim.value = withRepeat(
            withTiming(360, { duration: 10000, easing: Easing.linear }),
            -1,
            false 
        );
    }, [isTop10]);

    // 🔹 ANIMATED STYLES (No JS function calls inside here)
    const animatedSpinStyle = useAnimatedStyle(() => {
        const staticRotation = frameStyle.transform[0]?.rotate || '0deg';
        return {
            transform: [
                { rotate: staticRotation },
                { rotate: `${rotationAnim.value}deg` }
            ]
        };
    });

    const animatedPulseStyle = useAnimatedStyle(() => {
        const staticRotation = frameStyle.transform[0]?.rotate || '0deg';
        return {
            transform: [
                { rotate: staticRotation },
                { scale: pulseAnim.value }
            ]
        };
    });

    const containerSize = size + 12;

    return (
        <Pressable
            onPress={onPress}
            style={{ width: containerSize, height: containerSize }}
            className="relative shrink-0 items-center justify-center"
        >
            {/* Layer 1: Dashed Spinning Border (Top 5 only) */}
            {isTop10 && author?.rank <= 5 && (
                <Animated.View
                    style={[
                        frameStyle,
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
                        frameStyle,
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
                    frameStyle, 
                    { 
                        width: size, 
                        height: size, 
                        borderColor: isTop10 ? aura?.color : 'rgba(96, 165, 250, 0.3)', 
                        overflow: 'hidden', 
                        backgroundColor: isDark ? '#1a1d23' : '#f3f4f6',
                        zIndex: 2
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
                            <View className="absolute inset-0 items-center justify-center bg-gray-200 dark:bg-gray-800">
                                <Text>P</Text>
                            </View>
                        )}
                    </>
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
                style={[{ 
                    width: size * 0.3, 
                    height: size * 0.3, 
                    backgroundColor: isTop10 ? aura?.color : '#2563eb',
                    zIndex: 10
                }]} 
            />
        </Pressable>
    );
}
