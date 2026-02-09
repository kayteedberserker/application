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

const ClanCrest = ({ rank = 1, size = 120, isFeed = false }) => {
    const config = CLAN_TIERS[rank] || CLAN_TIERS[1];

    // Shared value for the pulse effect
    const pulseValue = useSharedValue(0);

    useEffect(() => {
        pulseValue.value = withRepeat(
            withTiming(1, { duration: 3000 }),
            -1,
            false
        );
    }, []);

    // New "Energy Pulse" style instead of a dumb scanning line
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
                <MaterialCommunityIcons name={config.icon} size={size * 0.7} color={config.color} />
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
                        borderColor: config.color,
                        shadowColor: config.color,
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
                    color: config.color,
                    textShadowColor: 'rgba(0,0,0,0.5)',
                    textShadowOffset: { width: 2, height: 2 },
                    textShadowRadius: 4
                }}
            >
                {config.label}
            </Text>

            {/* Rank Title */}
            {isFeed == false ? <View className="absolute -bottom-2">
                <Text
                    className="font-black uppercase tracking-[0.2em] text-[8px]"
                    style={{ color: config.color }}
                >
                    {config.title}
                </Text>
            </View> : null
            }
        </View>
    );
};

export default ClanCrest;