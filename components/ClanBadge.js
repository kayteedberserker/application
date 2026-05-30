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
    FlatList,
    Modal,
    Pressable, // ⚡️ Swapped to FlatList for virtualized item rendering
    StyleSheet,
    View
} from 'react-native';
import {
    cancelAnimation,
    useDerivedValue,
    useSharedValue,
    withRepeat,
    withTiming
} from 'react-native-reanimated';
import Svg, { G, Path as SvgPath } from 'react-native-svg';
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

    // ⚔️ ACTUAL CUSTOM CLAN PROGRESSION TIERS
    "HYPE VANGUARD": {
        title: "Hype Vanguard",
        sub: "10K+ Points",
        color: "#3b82f6",
        tier: TIER.EPIC,
        icon: ({ size, color }) => (
            <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
                <G transform="scale(0.85) translate(8, 8)">
                    {/* Multi-layered Cyber Aegis Front Shield */}
                    <SvgPath d="M50 5 L90 20 V55 C90 75 72 90 50 95 C28 90 10 75 10 55 V20 Z" stroke={color} strokeWidth="4" strokeLinejoin="round" />
                    {/* Inner Negative Space Fragment Plate */}
                    <SvgPath d="M50 17 L80 28 V53 C80 68 67 80 50 84 C33 80 20 68 20 53 V28 Z" fill={`${color}20`} stroke={color} strokeWidth="2" />
                    {/* Twin Wing Tech Rails */}
                    <SvgPath d="M32 38 L45 50 L32 62" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                    <SvgPath d="M68 38 L55 50 L68 62" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                    {/* Core Core Laser Node */}
                    <SvgPath d="M50 42 L55 50 L50 58 L45 50 Z" fill={color} />
                </G>
            </Svg>
        )
    },
    "HYPE SYNDICATE": {
        title: "Hype Syndicate",
        sub: "100K+ Points",
        color: "#a855f7",
        tier: TIER.EPIC,
        icon: ({ size, color }) => (
            <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
                <G transform="scale(0.85) translate(8, 8)">
                    {/* Outer Interlocking Geometric Hex-Triplex Frame */}
                    <SvgPath d="M50 8 L92 80 L8 80 Z" stroke={color} strokeWidth="4" strokeLinejoin="round" />
                    {/* Carved Out Cyberpunk Underlayer */}
                    <SvgPath d="M50 24 L80 74 H20 Z" fill={`${color}25`} stroke={color} strokeWidth="2" />
                    {/* Floating Tech Mandibles */}
                    <SvgPath d="M50 38 L65 65 H35 Z" stroke={color} strokeWidth="3" strokeLinejoin="round" />
                    {/* Central Syndicate Core Crest */}
                    <SvgPath d="M50 48 L56 58 H44 Z" fill={color} />
                    {/* Mechanical Sub-lines */}
                    <SvgPath d="M50 8 V24 M8 80 L20 74 M92 80 L80 74" stroke={color} strokeWidth="3" strokeLinecap="round" />
                </G>
            </Svg>
        )
    },
    "HYPE DYNASTY": {
        title: "Hype Dynasty",
        sub: "500K+ Points",
        color: "#ef4444",
        tier: TIER.LEGENDARY,
        icon: ({ size, color }) => (
            <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
                <G transform="scale(0.85) translate(8, 8)">
                    {/* Shogunate Mecha Overlord Crest / Layered Pagoda Citadel */}
                    <SvgPath d="M10 25 Q50 10 90 25 L82 35 Q50 25 18 35 Z" fill={color} />
                    {/* Main Gate Columns */}
                    <SvgPath d="M26 35 V85 H36 V35 Z M64 35 V85 H74 V35 Z" stroke={color} strokeWidth="3" fill={`${color}20`} />
                    {/* Aggressive Roof Wings */}
                    <SvgPath d="M18 48 Q50 38 82 48 L76 56 Q50 48 24 56 Z" fill={color} opacity="0.8" />
                    {/* Twin Energy Broad-blades In Center */}
                    <SvgPath d="M44 42 L50 35 L56 42 V75 L50 82 L44 75 Z" stroke={color} strokeWidth="2" fill={color} />
                    {/* Foundation Guard Rails */}
                    <SvgPath d="M5 85 H95 V92 H5 Z" fill={color} />
                </G>
            </Svg>
        )
    },
    "HYPE EMPIRE": {
        title: "Hype Empire",
        sub: "2M+ Points",
        color: "#fbbf24",
        tier: TIER.LEGENDARY,
        icon: ({ size, color }) => (
            <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
                <G transform="scale(0.85) translate(8, 8)">
                    {/* Five-Point Spiked Razor Crown Design */}
                    <SvgPath d="M8 28 L24 48 L50 15 L76 48 L92 28 V82 H8 Z" stroke={color} strokeWidth="4" strokeLinejoin="round" />
                    {/* Imperial Inner Guard Visor */}
                    <SvgPath d="M18 52 L28 62 H72 L82 52 V74 H18 Z" fill={`${color}30`} stroke={color} strokeWidth="2" />
                    {/* Relic Slots / Diamond Emblems */}
                    <SvgPath d="M50 35 L56 45 L50 55 L44 45 Z" fill={color} />
                    <SvgPath d="M24 55 L28 61 L24 67 L20 61 Z" fill={color} opacity="0.7" />
                    <SvgPath d="M76 55 L80 61 L76 67 L72 61 Z" fill={color} opacity="0.7" />
                    {/* Lower Fortress Grid Base */}
                    <SvgPath d="M8 82 H92 V90 H8 Z" fill={color} />
                </G>
            </Svg>
        )
    },
    "PEAK CLAN": {
        title: "Peak Clan",
        sub: "The Absolute Summit",
        color: "#10b981", // Emerald Neon Green
        tier: TIER.LEGENDARY,
        icon: ({ size, color }) => (
            <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
                <G transform="scale(0.85) translate(8, 8)">
                    {/* Outer Apex / Mountain Frame Geometry */}
                    <SvgPath d="M50 5 L92 45 L80 90 H20 L8 45 Z" stroke={color} strokeWidth="4" strokeLinejoin="round" />

                    {/* Inner Fractured Grid Plate */}
                    <SvgPath d="M50 20 L80 50 L70 80 H30 L20 50 Z" fill={`${color}20`} stroke={color} strokeWidth="1.5" />

                    {/* The Peak Crest (Geometric Split-Apex Mountain) */}
                    <SvgPath d="M50 28 L72 72 H58 L50 50 L42 72 H28 Z" fill={color} stroke={color} strokeWidth="2" strokeLinejoin="round" />

                    {/* Upward Laser Guidewires (Ascension Paths) */}
                    <SvgPath d="M18 78 L35 42 M82 78 L65 42" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.8" />

                    {/* Floating Zenith Crown Star */}
                    <SvgPath d="M50 12 L53 18 L59 18 L54 22 L56 28 L50 24 L44 28 L46 22 L41 18 L47 18 Z" fill={color} />
                </G>
            </Svg>
        )
    },
};

// Unified Icon Renderer - Wrapped in Memo to prevent recalculating vector styles
const BadgeIconComponent = ({ icon, size, color, glowRadius }) => {
    if (!icon) return null;

    if (typeof icon === 'string') {
        return (
            <MaterialCommunityIcons
                name={icon}
                size={size}
                color={color}
                style={{
                    opacity: 0.9,
                    textShadowColor: color,
                    textShadowRadius: glowRadius
                }}
            />
        );
    }

    const CustomIconComponent = icon;
    return (
        <View style={{
            opacity: 0.95,
            shadowColor: color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: glowRadius,
            elevation: glowRadius > 4 ? 6 : 2
        }}>
            <CustomIconComponent size={size} color={color} />
        </View>
    );
};
const BadgeIcon = memo(BadgeIconComponent);

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
                        <BadgeIcon icon={badge.icon} size={85} color={badge.color} glowRadius={0} />
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

    const handleOpenModal = useCallback(() => setModalVisible(true), []);
    const handleCloseModal = useCallback(() => setModalVisible(false), []);

    // ⚡️ FIXED: Extract useDerivedValue definitions to top-level to prevent UI-thread registration memory leaks
    const gradientStart = useDerivedValue(() => vec(shine.value * size * 4 - size * 2, 0), [size]);
    const gradientEnd = useDerivedValue(() => vec(shine.value * size * 4 - size, size), [size]);

    useEffect(() => {
        shine.value = withRepeat(
            withTiming(1, { duration: badge?.tier === TIER.LEGENDARY ? 2500 : 5000 }),
            -1,
            false
        );

        return () => {
            cancelAnimation(shine);
        };
    }, [badge?.tier]);

    if (!badge) return null;

    const iconSize = size * 0.46; // Marginally upscaled to balance custom vectors
    const glowRadius = badge.tier === TIER.LEGENDARY ? 12 : 5;

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
                                {/* ⚡️ Fixed: Passing optimized top-level hook declarations */}
                                <LinearGradient
                                    start={gradientStart}
                                    end={gradientEnd}
                                    colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']}
                                />
                                <Path path={path} />
                            </Group>
                        </Mask>
                    </Group>
                </Canvas>

                {/* Center Icon Overlay */}
                <View style={[StyleSheet.absoluteFill, styles.iconContainer]}>
                    <BadgeIcon
                        icon={badge.icon}
                        size={iconSize}
                        color={badge.color}
                        glowRadius={glowRadius}
                    />
                </View>
            </Pressable>

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
    const badgeKeys = useMemo(() => Object.keys(BADGE_LIBRARY), []);

    // ⚡️ FlatList optimization renderer
    const renderItem = useCallback(({ item }) => (
        <ClanBadge badgeName={item} size={size} />
    ), [size]);

    const keyExtractor = useCallback((item) => item, []);

    return (
        <FlatList
            data={badgeKeys}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            horizontal
            showsHorizontalScrollIndicator={false}
            className="py-4"
            contentContainerStyle={{ paddingHorizontal: 15 }}
            initialNumToRender={5}
            windowSize={3}
            maxToRenderPerBatch={5}
            removeClippedSubviews={true} // ⚡️ Completely removes unrendered Skia context items from RAM
        />
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