import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';

// ⚡️ IMPORTED UNIFIED COMPONENTS
import { ClanBadge } from "./ClanBadge";
import ClanBorder from "./ClanBorder";
import ClanCrest from "./ClanCrest";
import PlayerBackground from "./PlayerBackground";
import PlayerNameplate from "./PlayerNameplate";
import PlayerWatermark from "./PlayerWatermark";
import { Text } from "./Text";

const getClanTierDetails = (title) => {
    switch (title) {
        case "The Akatsuki": return { rank: 6, color: '#ef4444' };
        case "The Espada": return { rank: 5, color: '#e0f2fe' };
        case "Phantom Troupe": return { rank: 4, color: '#a855f7' };
        case "Upper Moon": return { rank: 3, color: '#60a5fa' };
        case "Squad 13": return { rank: 2, color: '#10b981' };
        default: return { rank: 1, color: '#94a3b8' }
    }
};

const RemoteSvgIcon = React.memo(({ xml, size = 50, color }) => {
    if (!xml) return <MaterialCommunityIcons name="help-circle-outline" size={size} color="gray" />;
    return <SvgXml xml={xml} width={size} height={size} />;
});

export default function ClanCard({ clan, isDark, THEME = { card: '#0a0a0a', text: '#ffffff', border: '#262626', accent: '#3b82f6' } }) {
    if (!clan) return null;

    // --- Special Inventory & Logic extraction ---
    const isVerified = clan.verifiedUntil && new Date(clan.verifiedUntil) > new Date();
    const verifiedTier = clan.activeCustomizations?.verifiedTier;
    const verifiedColor = verifiedTier === "premium" ? "#facc15" : verifiedTier === "standard" ? "#ef4444" : verifiedTier === "basic" ? "#3b82f6" : "";
    const rankInfo = getClanTierDetails(clan.rankTitle || "Wandering Ronin");
    const highlightColor = rankInfo.color || THEME.accent

    const equippedGlow = clan.specialInventory?.find(i => i.category === 'GLOW' && i.isEquipped);
    const activeGlowColor = equippedGlow?.visualConfig?.primaryColor || equippedGlow?.visualData?.glowColor || null;

    const equippedBg = clan.specialInventory?.find(i => i.category === 'BACKGROUND' && i.isEquipped);

    const equippedBorder = clan.specialInventory?.find(i => i.category === 'BORDER' && i.isEquipped);
    const borderVisual = equippedBorder?.visualConfig || equippedBorder?.visualData || {};

    const equippedWatermark = clan.specialInventory?.find(i => i.category === 'WATERMARK' && i.isEquipped);

    const nextMilestone = clan.nextThreshold || 5000;
    const currentPoints = clan.totalPoints || 0;
    const progress = Math.min((currentPoints / nextMilestone) * 100, 100);

    // ⚡️ Reanimated Shared Values
    const pulseScale = useSharedValue(1);
    const rotationDegrees = useSharedValue(0);

    useEffect(() => {
        pulseScale.value = withRepeat(
            withSequence(
                withTiming(1.1, { duration: 2000 }),
                withTiming(1, { duration: 2000 })
            ),
            -1,
            false
        );

        rotationDegrees.value = withRepeat(
            withTiming(360, {
                duration: 20000,
                easing: Easing.linear,
            }),
            -1,
            false
        );
    }, []);

    // ⚡️ UI Thread Animated Styles
    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }]
    }));

    const rotationStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotationDegrees.value}deg` }]
    }));

    const CardInner = (
        <View
            className="relative p-8 bg-white dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-800 overflow-hidden shadow-2xl"
            style={{
                borderRadius: 27,
                width: 372,
                borderWidth: equippedBorder ? 0 : 1,
                borderColor: isVerified ? highlightColor : (isDark ? '#262626' : '#f3f4f6')
            }}
        >
            {/* ⚡️ Background & Watermark Integrations */}
            <PlayerBackground equippedBg={equippedBg} themeColor={rankInfo.color} borderRadius={27} />
            <PlayerWatermark isVisible={true} equippedWatermark={equippedWatermark} isDark={isDark} />

            {/* ⚡️ THE PLAYER CARD TOP IDENTIFIER STRUCTURE */}
            <View className="flex-row justify-between items-center mb-6 opacity-40 relative z-10">
                <Text className="text-[15px] font-black tracking-[0.6em] text-gray-500 dark:text-gray-400">CLAN CARD</Text>
                <View className="flex-row gap-1.5">
                    <View className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                    <View className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                    <View className="w-10 h-1.5 rounded-full bg-gray-400" />
                </View>
            </View>

            <View className="items-center z-10 w-full relative">
                <View className="relative items-center justify-center mb-4">
                    <Animated.View
                        style={[
                            {
                                position: 'absolute', width: 140, height: 140, borderRadius: 100,
                                backgroundColor: activeGlowColor || highlightColor,
                                opacity: 0.1
                            },
                            pulseStyle
                        ]}
                    />
                    <Animated.View
                        style={[
                            { borderColor: `${activeGlowColor || highlightColor}40`, width: 160, height: 160 },
                            rotationStyle
                        ]}
                        className="absolute border border-dashed rounded-full"
                    />
                    <ClanCrest rank={clan.rank || 1} size={130} glowColor={activeGlowColor} />
                </View>

                <View className="flex-row items-center justify-center gap-1 mb-2 w-full">
                    <PlayerNameplate
                        author={{ username: clan.name }}
                        themeColor={rankInfo.color}
                        equippedGlow={equippedGlow}
                        auraRank={999}
                        fontSize={30}
                        isDark={isDark}
                        showPeakBadge={false}
                        isVisible={true}
                        showFlame={false}
                    />
                    {isVerified && (
                        <View className="ml-1">
                            <RemoteSvgIcon size={24} xml={clan.activeCustomizations?.verifiedBadgeXml} />
                        </View>
                    )}
                </View>

                <Text className="text-sm text-gray-500 dark:text-gray-400 text-center italic px-4 mb-6">
                    "{clan.description || "A gathering of warriors with no code..."}"
                </Text>

                {/* Stats with Line Separation matching PlayerCard structure */}
                <View className="flex-row justify-between w-full border-y border-gray-100 dark:border-gray-800 py-5 px-2 mb-6">
                    <View className="items-center flex-1">
                        <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Followers</Text>
                        <Text className="text-xl font-black dark:text-white">{clan.followerCount?.toLocaleString() || 0}</Text>
                    </View>
                    <View className="items-center flex-1 border-l border-gray-100 dark:border-gray-800">
                        <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Points</Text>
                        <Text className="text-xl font-black" style={{ color: activeGlowColor || verifiedColor || highlightColor }}>{currentPoints.toLocaleString()}</Text>
                    </View>
                    <View className="items-center flex-1 border-l border-gray-100 dark:border-gray-800">
                        <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Members</Text>
                        <Text className="text-xl font-black dark:text-white">{clan.members?.length || 0}/{clan.maxSlots || 5}</Text>
                    </View>
                </View>

                {/* Earned Medals Container */}
                <View className="w-full mb-6">
                    {clan.badges?.length > 0 ? (
                        <View className="flex-row flex-wrap justify-center gap-2 w-full px-4">
                            {clan.badges.map((badgeName, idx) => (
                                <ClanBadge key={`${badgeName}-${idx}`} isClanPage={true} badgeName={badgeName} size={50} />
                            ))}
                        </View>
                    ) : (
                        <View className="items-center py-2">
                            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">No Medals Earned</Text>
                        </View>
                    )}
                </View>

                {/* Progress */}
                <View className="w-full px-2 mt-4">
                    <View className="flex-row justify-between items-end mb-3 px-1">
                        <View className="flex-row items-center gap-3">
                            <MaterialCommunityIcons name="sword-cross" size={26} color={activeGlowColor || highlightColor} />
                            <View>
                                <Text style={{ color: activeGlowColor || highlightColor }} className="text-[9px] font-mono uppercase tracking-[0.2em] leading-none mb-1">CLAN_RANK</Text>
                                <Text className="text-xs font-black uppercase tracking-widest dark:text-white">
                                    {clan.rankTitle}
                                </Text>
                            </View>
                        </View>
                        <Text className="text-[10px] font-mono font-bold text-gray-500 uppercase mb-1">
                            PTS: {currentPoints} / {nextMilestone}
                        </Text>
                    </View>

                    <View className="h-2 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                        <View style={{ width: `${progress}%`, backgroundColor: activeGlowColor || highlightColor }} className="h-full shadow-lg" />
                    </View>
                </View>

                {/* Leadership Structure replaced with PlayerCard-style Dash footer */}
                <View className="w-full mt-8 pt-5 border-t border-dashed border-gray-200 dark:border-gray-800 flex-row justify-between items-center px-1">
                    <View className="flex-row gap-1">
                        <View className="w-4 h-1 bg-gray-200 dark:bg-gray-800 rounded-full" />
                        <View className="w-2 h-1 bg-gray-200 dark:bg-gray-800 rounded-full" />
                    </View>
                    <Text className="text-[10px] font-mono text-gray-400 dark:text-gray-500 uppercase tracking-tighter">
                        TAG: {clan.tag}
                    </Text>
                </View>

            </View>
        </View>
    );

    return (
        <View className="mb-4 self-center">
            {equippedBorder ? (
                <ClanBorder
                    color={borderVisual.primaryColor || borderVisual.color || "#ff0000"}
                    secondaryColor={borderVisual.secondaryColor || null}
                    animationType={borderVisual.animationType || "singleSnake"}
                    snakeLength={borderVisual.snakeLength || 400}
                    duration={borderVisual.duration || 3000}
                >
                    {CardInner}
                </ClanBorder>
            ) : (
                CardInner
            )}
        </View>
    );
}