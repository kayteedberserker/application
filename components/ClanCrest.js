import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
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

const ClanCrest = ({ rank = 1, size = 120, isFeed = false, glowColor = null }) => {
    const config = CLAN_TIERS[rank] || CLAN_TIERS[1];

    // Use glowColor if provided, otherwise fallback to rank color
    const displayColor = glowColor || config.color;

    const pulseValue = useSharedValue(0);

    useEffect(() => {
        if (isFeed) {
            pulseValue.value = 0.5; // Set to a middle-point static state
            return;
        }

        pulseValue.value = withRepeat(
            withTiming(1, { duration: 3000 }),
            -1,
            false
        );
    }, [isFeed]);

    const pulseStyle = useAnimatedStyle(() => {
        const scale = interpolate(pulseValue.value, [0, 1], [0.6, 1.4]);
        const opacity = interpolate(pulseValue.value, [0, 0.5, 1], [0, 0.6, 0]);

        return {
            transform: [{ scale }],
            opacity,
            borderWidth: interpolate(pulseValue.value, [0, 1], [4, 1]),
        };
    });

    return (
        <View style={{ width: size, height: size }} className="items-center justify-center relative">
            {/* Background Symbol Icon */}
            <View className="absolute opacity-20">
                <MaterialCommunityIcons name={config.icon} size={size * 0.7} color={displayColor} />
            </View>

            {/* Energy Wave Pulse */}
            <Animated.View
                style={[
                    pulseStyle,
                    {
                        position: 'absolute',
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        borderColor: displayColor,
                        shadowColor: displayColor,
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.8,
                        shadowRadius: 15,
                    }
                ]}
            />

            {/* Roman Numeral Figure */}
            <Text
                className="font-black italic tracking-tighter z-10"
                style={{
                    fontSize: size * 0.35,
                    color: displayColor,
                    textShadowColor: 'rgba(0,0,0,0.5)',
                    textShadowOffset: { width: 2, height: 2 },
                    textShadowRadius: 4
                }}
            >
                {config.label}
            </Text>

            {/* Rank Title */}
            {!isFeed && (
                <View className="absolute -bottom-2">
                    <Text
                        className="font-black uppercase tracking-[0.2em] text-[8px]"
                        style={{ color: displayColor }}
                    >
                        {config.title}
                    </Text>
                </View>
            )}
        </View>
    );
};

export default ClanCrest;