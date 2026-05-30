import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo } from 'react'; // ⚡️ Added useMemo
import { View } from 'react-native';
import Animated, {
    cancelAnimation, // ⚡️ ADDED: For cleanup
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming
} from 'react-native-reanimated';
import { Text } from './Text';

const CLAN_TIERS = {
    6: { label: 'VI', color: '#ef4444', icon: 'cloud', title: "The Akatsuki" },
    5: { label: 'V', color: '#e0f2fe', icon: 'skull', title: "The Espada" },
    4: { label: 'IV', color: '#a855f7', icon: 'spider', title: "Phantom Troupe" },
    3: { label: 'III', color: '#60a5fa', icon: 'eye', title: "Upper Moon" },
    2: { label: 'II', color: '#10b981', icon: 'sword-cross', title: "Squad 13" },
    1: { label: 'I', color: '#94a3b8', icon: 'weather-windy', title: "Wandering Ronin" },
};

// ⚡️ PERFORMANCE: Wrap in memo to prevent unnecessary re-renders in feeds
const ClanCrest = React.memo(({ rank = 1, size = 120, isFeed = false, glowColor = null, isVisible = true }) => {
    const config = CLAN_TIERS[rank] || CLAN_TIERS[1];
    const displayColor = glowColor || config.color;
    const pulseValue = useSharedValue(0);

    // Determine animation rule: only kill animation when it IS in the feed AND NOT visible.
    const shouldAnimate = !isFeed || isVisible;

    // ⚡️ PERFORMANCE OPTIMIZATION: Memoize structural styles to prevent re-allocation on list scroll
    const containerStyle = useMemo(() => ({ width: size, height: size }), [size]);
    const iconSize = useMemo(() => size * 0.7, [size]);

    const pulseContainerStyle = useMemo(() => ({
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderColor: displayColor,
        borderWidth: 2, // ⚡️ FIX: Kept static to keep calculations completely off the layout thread
    }), [size, displayColor]);

    const numeralStyle = useMemo(() => ({
        fontSize: size * 0.35,
        color: displayColor,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 2, height: 2 },
        textShadowRadius: 4
    }), [size, displayColor]);

    const titleStyle = useMemo(() => ({ color: displayColor }), [displayColor]);

    useEffect(() => {
        // Clear any existing animation before starting or stopping
        cancelAnimation(pulseValue);

        if (!shouldAnimate) {
            pulseValue.value = 0;
            return;
        }

        pulseValue.value = withRepeat(
            withTiming(1, { duration: 3000 }),
            -1,
            false
        );

        // ⚡️ CLEANUP: Stop the UI thread animation when component unmounts
        return () => cancelAnimation(pulseValue);
    }, [shouldAnimate, rank]);

    // ⚡️ PERFORMANCE OPTIMIZATION: Stripped out layout recalculations (borderWidth)
    const pulseStyle = useAnimatedStyle(() => {
        const scale = interpolate(pulseValue.value, [0, 1], [0.6, 1.4]);
        const opacity = interpolate(pulseValue.value, [0, 0.5, 1], [0, 0.6, 0]);

        return {
            transform: [{ scale }],
            opacity,
        };
    });

    return (
        <View style={containerStyle} className="items-center justify-center relative">
            {/* Background Symbol Icon */}
            <View className="absolute opacity-20" pointerEvents="none">
                <MaterialCommunityIcons name={config.icon} size={iconSize} color={displayColor} />
            </View>

            {/* Energy Wave Pulse */}
            <Animated.View style={[pulseStyle, pulseContainerStyle]} />

            {/* Roman Numeral Figure */}
            <Text
                className="font-black italic tracking-tighter z-10"
                style={numeralStyle}
            >
                {config.label}
            </Text>

            {/* Rank Title */}
            {!isFeed && (
                <View className="absolute -bottom-2">
                    <Text
                        className="font-black uppercase tracking-[0.2em] text-[8px]"
                        style={titleStyle}
                    >
                        {config.title}
                    </Text>
                </View>
            )}
        </View>
    );
});

export default ClanCrest;