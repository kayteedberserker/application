import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurMask, Canvas, LinearGradient, RoundedRect, vec } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import { Text } from './Text';

const AnimatedView = Animated.createAnimatedComponent(View);

export const BADGE_LIBRARY = {
    "The Pirate King": { icon: "skull-crossbones", title: "Pirate King", sub: "Weekly #1", color: "#fbbf24" },
    "The Pillars": { icon: "pillar", title: "The Pillars", sub: "Weekly Top 3", color: "#f87171" },
    "Hunter Association": { icon: "compass-outline", title: "Hunters", sub: "Weekly Top 10", color: "#60a5fa" },
    "Talk-no-jutsu": { icon: "chat-processing", title: "Talk-no-jutsu", sub: "Most Discussed", color: "#fbbf24" },
    "Gear 2nd": { icon: "lightning-bolt", title: "Gear 2nd", sub: "2.0X Growth", color: "#ef4444" },
    "Gotei 13": { icon: "shield-sword", title: "Gotei 13", sub: "10+ Members", color: "#a855f7" },
    "The 5 Kage": { icon: "account-group", title: "The 5 Kage", sub: "5+ Members", color: "#f97316" },
    "Library of Ohara": { icon: "library", title: "Ohara", sub: "1K+ Posts", color: "#3b82f6" },
    "Sage Mode": { icon: "eye", title: "Sage Mode", sub: "High Activity", color: "#10b981" },
    "Zenkai Boost": { icon: "dna", title: "Zenkai Boost", sub: "1.5X Growth", color: "#f472b6" },
    "Unlimited Chakra": { icon: "infinity", title: "Unlimited", sub: "4 Wks Stable", color: "#2dd4bf" },
    "Final Form": { icon: "fire", title: "Final Form", sub: "Rank 6 Achieved", color: "#f87171" },
    "One-Shot": { icon: "target", title: "One-Shot", sub: "500 Likes/Hr", color: "#ef4444" },
    "King's Haki": { icon: "waves", title: "King's Haki", sub: "100K+ Total Likes", color: "#7c3aed" },
    "Scouter Lvl 1": { icon: "radar", title: "Scouter Lvl 1", sub: "1K+ Followers", color: "#4ade80" },
    "Scouter Lvl 2": { icon: "radar", title: "Scouter Lvl 2", sub: "5K+ Followers", color: "#22c55e" },
    "Scouter Lvl 3": { icon: "radar", title: "Scouter Lvl 3", sub: "10K+ Followers", color: "#16a34a" },
    "Scouter Lvl 4": { icon: "radar", title: "Scouter Lvl 4", sub: "50K+ Followers", color: "#15803d" },
    "Scouter: Broken Scale": { icon: "alert-decagram", title: "Broken Scale", sub: "80K+ Followers", color: "#facc15" },
    "Scouter: It's Over 9000": { icon: "flash", title: "Over 9000", sub: "100K+ Followers", color: "#dc2626" },
};

export const ClanBadge = ({ badgeName, isClanPage = false, size = 'md', forSnapshot = false }) => {
    const badge = BADGE_LIBRARY[badgeName];
    if (!badge) return null;

    // We keep shared values for structural consistency, but set them to static targets
    const scale = useSharedValue(forSnapshot ? 1 : 1); 
    const opacity = useSharedValue(forSnapshot ? 1 : 0);

    const isLarge = size === 'lg';
    const containerWidth = isLarge ? 120 : 100;
    const iconSize = isLarge ? 32 : 24;

    useEffect(() => {
        if (!forSnapshot) {
            // Simple fade in without the bobbing or bouncing
            opacity.value = withTiming(1, { duration: 400 });
            scale.value = 1;
        }
    }, [forSnapshot]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [
            { scale: scale.value }
        ],
    }));

    return (
        <AnimatedView style={[styles.container, { width: containerWidth }, animatedStyle]}>
            <View style={StyleSheet.absoluteFill}>
                {/* ViewShot often struggles with Skia Canvas in hidden layers. 
                    If forSnapshot is true, we use a simple View background instead of Canvas */}
                {forSnapshot ? (
                    <View 
                        style={{ 
                            flex: 1, 
                            backgroundColor: `${badge.color}20`, 
                            borderRadius: 20, 
                            borderWidth: 1, 
                            borderColor: `${badge.color}40` 
                        }} 
                    />
                ) : (
                    <Canvas style={{ flex: 1 }}>
                        <RoundedRect
                            x={5}
                            y={5}
                            width={containerWidth - 10}
                            height={isLarge ? 130 : 110}
                            r={20}
                            color="transparent"
                        >
                            <BlurMask blur={15} style="outer" />
                            <LinearGradient
                                start={vec(0, 0)}
                                end={vec(containerWidth, 110)}
                                colors={[`${badge.color}40`, `${badge.color}10`, 'transparent']}
                            />
                        </RoundedRect>
                    </Canvas>
                )}
            </View>

            <View className="items-center justify-center p-3 rounded-[25px] border border-white/10 bg-white/5 dark:bg-black/20">
                <View
                    className="p-3 rounded-full mb-2 shadow-lg"
                    style={{ backgroundColor: `${badge.color}20` }}
                >
                    <MaterialCommunityIcons name={badge.icon} size={iconSize} color={badge.color} />
                </View>

                <Text className="text-[10px] font-black uppercase text-center tracking-tighter dark:text-white" numberOfLines={1}>
                    {badge.title}
                </Text>
                {!isClanPage && <Text className="text-[8px] font-bold text-center opacity-60 dark:text-gray-400" numberOfLines={1}>
                    {badge.sub}
                </Text>}
            </View>
        </AnimatedView>
    );
};

const styles = StyleSheet.create({
    container: {
        marginRight: 12,
        paddingVertical: 10,
    },
});

export const BadgeShowcase = ({ isClanPage = false, size = 'md' }) => {
    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-12">
            {Object.keys(BADGE_LIBRARY).map((badgeKey) => (
                <ClanBadge 
                    key={badgeKey} 
                    badgeName={badgeKey} 
                    isClanPage={isClanPage} 
                    size={size} 
                />
            ))}
        </ScrollView>
    );
};