import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
    BlurMask,
    Canvas,
    CornerPathEffect,
    Group,
    LinearGradient,
    Mask,
    Path,
    Skia,
    vec
} from '@shopify/react-native-skia';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    View
} from 'react-native';
import {
    cancelAnimation, // ⚡️ ADDED: For cleaning up the shine animation
    useDerivedValue,
    useSharedValue,
    withRepeat,
    withTiming
} from 'react-native-reanimated';
import { Text } from './Text';

// Tier Definitions
const TIER = {
    LEGENDARY: 'legendary', // Sharp Hexagon
    EPIC: 'epic',           // Rounded Hexagon
    RARE: 'rare'            // Slanted Rectangle
};

/**
 * PATH FACTORY
 * Generates shapes with internal padding to prevent clipping.
 */
const getBadgePath = (size, tier) => {
    const path = Skia.Path.Make();
    const padding = 2;
    const s = size - padding * 2;
    const center = size / 2;

    if (tier === TIER.LEGENDARY || tier === TIER.EPIC) {
        // Hexagon Logic
        const r = s / 2;
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 2;
            const x = center + r * Math.cos(angle);
            const y = center + r * Math.sin(angle);
            if (i === 0) path.moveTo(x, y);
            else path.lineTo(x, y);
        }
        path.close();
    } else {
        // Slanted Rectangle (Rare)
        const slant = s * 0.15;
        path.moveTo(padding + slant, padding);
        path.lineTo(size - padding, padding);
        path.lineTo(size - padding - slant, size - padding);
        path.lineTo(padding, size - padding);
        path.close();
    }
    return path;
};

export const BADGE_LIBRARY = {
    "The Pirate King": { icon: "skull-crossbones", title: "Pirate King", sub: "Weekly #1", color: "#fbbf24", tier: TIER.LEGENDARY },
    "The Pillars": { icon: "pillar", title: "The Pillars", sub: "Weekly Top 3", color: "#f87171", tier: TIER.EPIC },
    "Hunter Association": { icon: "compass-outline", title: "Hunters", sub: "Weekly Top 10", color: "#60a5fa", tier: TIER.RARE },
    "Talk-no-jutsu": { icon: "chat-processing", title: "Talk-no-jutsu", sub: "Most Discussed", color: "#fbbf24", tier: TIER.LEGENDARY },
    "Gear 2nd": { icon: "lightning-bolt", title: "Gear 2nd", sub: "2.0X Growth", color: "#ef4444", tier: TIER.EPIC },
    "Gotei 13": { icon: "shield-sword", title: "Gotei 13", sub: "10+ Members", color: "#a855f7", tier: TIER.RARE },
    "The 5 Kage": { icon: "account-group", title: "The 5 Kage", sub: "5+ Members", color: "#f97316", tier: TIER.LEGENDARY },
    "Library of Ohara": { icon: "library", title: "Ohara", sub: "1K+ Posts", color: "#3b82f6", tier: TIER.RARE },
    "Sage Mode": { icon: "eye", title: "Sage Mode", sub: "High Activity", color: "#10b981", tier: TIER.RARE },
    "Zenkai Boost": { icon: "dna", title: "Zenkai Boost", sub: "1.5X Growth", color: "#f472b6", tier: TIER.EPIC },
    "Unlimited Chakra": { icon: "infinity", title: "Unlimited", sub: "4 Wks Stable", color: "#2dd4bf", tier: TIER.RARE },
    "Final Form": { icon: "fire", title: "Final Form", sub: "Rank 6 Achieved", color: "#f87171", tier: TIER.EPIC },
    "One-Shot": { icon: "target", title: "One-Shot", sub: "500 Likes/Hr", color: "#ef4444", tier: TIER.EPIC },
    "King's Haki": { icon: "waves", title: "King's Haki", sub: "100K+ Total Likes", color: "#7c3aed", tier: TIER.LEGENDARY },
    "Scouter Lvl 1": { icon: "radar", title: "Scouter Lvl 1", sub: "1K+ Followers", color: "#4ade80", tier: TIER.RARE },
    "Scouter Lvl 2": { icon: "radar", title: "Scouter Lvl 2", sub: "5K+ Followers", color: "#22c55e", tier: TIER.RARE },
    "Scouter Lvl 3": { icon: "radar", title: "Scouter Lvl 3", sub: "10K+ Followers", color: "#16a34a", tier: TIER.RARE },
    "Scouter Lvl 4": { icon: "radar", title: "Scouter Lvl 4", sub: "50K+ Followers", color: "#15803d", tier: TIER.EPIC },
    "Scouter: Broken Scale": { icon: "alert-decagram", title: "Broken Scale", sub: "80K+ Followers", color: "#facc15", tier: TIER.EPIC },
    "Scouter: It's Over 9000": { icon: "flash", title: "Over 9000", sub: "100K+ Followers", color: "#dc2626", tier: TIER.LEGENDARY },
};

// Extracted and memoized Modal Component
const BadgeDetailModalComponent = ({ visible, onClose, badge }) => {
    if (!badge) return null;
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.modalOverlay} onPress={onClose}>
                <View className="bg-[#0f0f0f] p-8 rounded-[35px] items-center border border-white/5 w-[85%] shadow-2xl">
                    <View
                        className="p-6 rounded-full mb-6"
                        style={{ backgroundColor: `${badge.color}10`, shadowColor: badge.color, shadowRadius: 30, shadowOpacity: 0.2 }}
                    >
                        <MaterialCommunityIcons name={badge.icon} size={75} color={badge.color} />
                    </View>
                    <Text className="text-[10px] font-black text-gray-600 uppercase tracking-[0.5em] mb-2">
                        {badge.tier} Status
                    </Text>
                    <Text className="text-3xl font-black text-white text-center uppercase tracking-tighter mb-1">
                        {badge.title}
                    </Text>
                    <Text className="text-gray-500 font-bold text-center mb-8 px-6 text-sm">
                        {badge.sub}
                    </Text>
                    <Pressable
                        onPress={onClose}
                        className="bg-white/5 w-full py-4 rounded-xl border border-white/5 items-center"
                    >
                        <Text className="text-gray-400 font-bold uppercase text-xs tracking-widest">Acknowledge</Text>
                    </Pressable>
                </View>
            </Pressable>
        </Modal>
    );
};
const BadgeDetailModal = memo(BadgeDetailModalComponent);

// Extracted ClanBadge Component
const ClanBadgeComponent = ({ badgeName, size = 80 }) => {
    const badge = BADGE_LIBRARY[badgeName];
    const [modalVisible, setModalVisible] = useState(false);

    const shine = useSharedValue(0);
    const path = useMemo(() => getBadgePath(size, badge?.tier), [size, badge?.tier]);

    // Stable callbacks for memoized children
    const handleOpenModal = useCallback(() => setModalVisible(true), []);
    const handleCloseModal = useCallback(() => setModalVisible(false), []);

    useEffect(() => {
        shine.value = withRepeat(
            withTiming(1, { duration: badge?.tier === TIER.LEGENDARY ? 2500 : 5000 }),
            -1,
            false
        );

        // ⚡️ PERFORMANCE FIX 1: Cleanup the shared value animation when component unmounts
        return () => {
            cancelAnimation(shine);
        };
    }, [badge?.tier]);

    if (!badge) return null;

    const iconSize = size * 0.42;

    return (
        <>
            <Pressable
                onPress={handleOpenModal}
                style={{ width: size, height: size, marginRight: 10 }}
            >
                <Canvas style={{ flex: 1 }}>
                    <Group>
                        {/* 1. Subtle Background */}
                        <Path path={path} color={`${badge.color}08`} />

                        {/* 2. Refined Thin Border */}
                        <Path
                            path={path}
                            style="stroke"
                            strokeWidth={1.2}
                            color={`${badge.color}90`}
                        >
                            {badge.tier === TIER.EPIC && <CornerPathEffect r={size * 0.12} />}
                            {badge.tier === TIER.LEGENDARY && <BlurMask blur={2} style="solid" />}
                        </Path>

                        {/* 3. Shine Layer */}
                        <Mask mask={
                            <Path path={path}>
                                {badge.tier === TIER.EPIC && <CornerPathEffect r={size * 0.12} />}
                            </Path>
                        }>
                            <Group>
                                <LinearGradient
                                    start={useDerivedValue(() => vec(shine.value * size * 4 - size * 2, 0))}
                                    end={useDerivedValue(() => vec(shine.value * size * 4 - size, size))}
                                    colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']}
                                />
                                <Path path={path} />
                            </Group>
                        </Mask>
                    </Group>
                </Canvas>

                {/* Center Icon Overlay */}
                <View style={[StyleSheet.absoluteFill, styles.iconContainer]}>
                    <MaterialCommunityIcons
                        name={badge.icon}
                        size={iconSize}
                        color={badge.color}
                        style={{
                            opacity: 0.9,
                            textShadowColor: badge.color,
                            textShadowRadius: badge.tier === TIER.LEGENDARY ? 10 : 4
                        }}
                    />
                </View>
            </Pressable>

            {/* ⚡️ PERFORMANCE FIX 2: Only mount the Modal node when it's actually visible */}
            {modalVisible && (
                <BadgeDetailModal
                    visible={modalVisible}
                    onClose={handleCloseModal}
                    badge={badge}
                />
            )}
        </>
    );
};
export const ClanBadge = memo(ClanBadgeComponent);

// Extracted Showcase Component
const BadgeShowcaseComponent = ({ size = 75 }) => {
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-row py-4"
            contentContainerStyle={{ paddingHorizontal: 15 }}
        >
            {Object.keys(BADGE_LIBRARY).map((badgeKey) => (
                <ClanBadge
                    key={badgeKey}
                    badgeName={badgeKey}
                    size={size}
                />
            ))}
        </ScrollView>
    );
};
export const BadgeShowcase = memo(BadgeShowcaseComponent);

const styles = StyleSheet.create({
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.92)',
        justifyContent: 'center',
        alignItems: 'center',
    }
});