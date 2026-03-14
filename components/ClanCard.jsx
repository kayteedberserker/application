import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect } from "react";
import { Image, ScrollView, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop, SvgXml } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing
} from 'react-native-reanimated';

import { ClanBadge } from "./ClanBadge";
import ClanBorder from "./ClanBorder";
import ClanCrest from "./ClanCrest";
import { CardWatermark } from "./SigilLibrary";
import { Text } from "./Text";

const getClanTierDetails = (title) => {
  switch (title) {
    case "The Akatsuki": return { rank: 6, color: '#ef4444' };
    case "The Espada": return { rank: 5, color: '#e0f2fe' };
    case "Phantom Troupe": return { rank: 4, color: '#a855f7' };
    case "Upper Moon": return { rank: 3, color: '#60a5fa' };
    case "Squad 13": return { rank: 2, color: '#10b981' };
    default: return { rank: 1, color: '#94a3b8' };
  }
};

export default function ClanCard({ clan, isDark, THEME = { card: '#0a0a0a', text: '#ffffff', border: '#262626', accent: '#3b82f6' } }) {
  if (!clan) return null;

  // --- Special Inventory & Logic extraction ---
  const isVerified = clan.verifiedUntil && new Date(clan.verifiedUntil) > new Date();
  const verifiedTier = clan.activeCustomizations?.verifiedTier;
  const verifiedColor = verifiedTier == "premium" ? "#facc15" : verifiedTier == "standard" ? "#ef4444" : "basic" ? "#3b82f6" : null
  const rankInfo = getClanTierDetails(clan.rankTitle || "Wandering Ronin");
  const highlightColor = isVerified ? verifiedColor : (rankInfo.color || THEME.accent);
  
  const equippedGlow = clan.specialInventory?.find(i => i.category === 'GLOW' && i.isEquipped);
  const activeGlowColor = equippedGlow?.visualConfig?.primaryColor || equippedGlow?.visualData?.glowColor || null;

  const equippedBg = clan.specialInventory?.find(i => i.category === 'BACKGROUND' && i.isEquipped);
  const bgVisual = equippedBg?.visualConfig || equippedBg?.visualData || {};

  const equippedBorder = clan.specialInventory?.find(i => i.category === 'BORDER' && i.isEquipped);
  const borderVisual = equippedBorder?.visualConfig || equippedBorder?.visualData || {};

  // --- WATERMARK LOGIC ---
  const equippedWatermark = clan.specialInventory?.find(i => i.category === 'WATERMARK' && i.isEquipped);
  const watermarkVisual = equippedWatermark?.visualConfig || equippedWatermark?.visualData || {};

  // Get all equipped visual badges (separate from the earned medals)
  const specialBadges = clan.specialInventory?.filter(i => i.category === 'BADGE' && i.isEquipped) || [];

  const nextMilestone = clan.nextThreshold || 5000;
  const currentPoints = clan.totalPoints || 0;
  const progress = Math.min((currentPoints / nextMilestone) * 100, 100);

  // ⚡️ Reanimated Shared Values
  const pulseScale = useSharedValue(1);
  const rotationDegrees = useSharedValue(0);

  useEffect(() => {
    // Pulse Animation (1 -> 1.1 -> 1 infinitely)
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 2000 }),
        withTiming(1, { duration: 2000 })
      ),
      -1, 
      false 
    );

    // Rotation Animation (0 -> 360 infinitely)
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

  const SpecialWatermark = () => {
    if (!equippedWatermark) return null;

    const iconSize = watermarkVisual.size || 320;
    const iconColor = watermarkVisual.color || (isDark ? 'white' : 'black');

    return (
      <View
        className="absolute"
        style={{
          bottom: -20,
          right: -20,
          opacity: 0.7,
          transform: [{ rotate: watermarkVisual.rotation || '-15deg' }]
        }}
        pointerEvents="none"
      >
        {watermarkVisual.svgCode ? (
          <SvgXml
            xml={watermarkVisual.svgCode.replace(/currentColor/g, iconColor)}
            width={iconSize}
            height={iconSize}
          />
        ) : (
          <MaterialCommunityIcons
            name={watermarkVisual.icon || 'fountain-pen-tip'}
            size={iconSize}
            color={iconColor}
          />
        )}
      </View>
    );
  };

  const CardInner = (
    <View
      className="relative p-8 overflow-hidden"
      style={{
        borderRadius: 28,
        width: 380,
        backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
        borderWidth: equippedBorder ? 0 : 1,
        borderColor: isVerified ? highlightColor : (isDark ? '#262626' : '#f3f4f6')
      }}
    >
      {/* --- SVG BACKGROUND GLOW --- */}
      {equippedBg && (
        <View className="absolute inset-0">
          <Svg height="100%" width="100%">
            <Defs>
              <LinearGradient id="clanCardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={bgVisual.primaryColor || highlightColor} stopOpacity={0.15} />
                <Stop offset="100%" stopColor={bgVisual.secondaryColor || bgVisual.primaryColor} stopOpacity={0.02} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#clanCardGrad)" />
          </Svg>
        </View>
      )}

      {/* NEW SYSTEM WATERMARK */}
      <SpecialWatermark />

      {/* LEGACY SYSTEM WATERMARK (Backward compatibility) */}
      {clan.equippedSigil && !equippedWatermark && (
        <CardWatermark name={clan.equippedSigil} color={highlightColor} size={320} />
      )}

      <View className="items-center z-10">
        <View className="relative items-center justify-center mb-4">
          <Animated.View
            style={[
              {
                position: 'absolute', width: 140, height: 140, borderRadius: 100,
                // ⚡️ Added fallback to highlightColor so it never sets `backgroundColor: null`
                backgroundColor: activeGlowColor || highlightColor, 
                opacity: 0.1
              },
              pulseStyle
            ]}
          />
          <Animated.View
            style={[
              // ⚡️ FIXED: Guaranteed a valid hex code before appending '40'
              { borderColor: `${activeGlowColor || highlightColor}40`, width: 160, height: 160 },
              rotationStyle
            ]}
            className="absolute border border-dashed rounded-full"
          />
          <ClanCrest rank={clan.rank || 1} size={130} glowColor={activeGlowColor || verifiedColor} />
        </View>

        {/* Equipped Special Badges Row */}
        {specialBadges.length > 0 && (
          <View className="flex-row gap-2 mb-4">
            {specialBadges.map((badge, bIdx) => (
              <View key={`spec-${bIdx}`} className="bg-white/5 p-1 rounded-full border border-white/10">
                <ClanBadge badgeName={badge.id} size="xs" />
              </View>
            ))}
          </View>
        )}

        <View className="flex-row gap-2 items-center mb-1">
          <Text className="text-3xl font-black italic uppercase tracking-tighter dark:text-white">
            {clan.name}
          </Text>
          {isVerified && (
            <RemoteSvgIcon size={24} xml={clan.activeCustomizations?.verifiedBadgeXml} />
          )}
        </View>

        <View style={{ backgroundColor: `${highlightColor}10`, borderColor: `${highlightColor}20` }} className="px-4 py-1.5 rounded-full border mb-4">
          <Text style={{ color: activeGlowColor || highlightColor }} className="text-xs font-bold tracking-widest uppercase">#{clan.tag}</Text>
        </View>

        <Text className="text-sm text-gray-500 dark:text-gray-400 text-center italic px-4 mb-6">
          "{clan.description || "A gathering of warriors with no code..."}"
        </Text>

        {/* Stats */}
        <View className="flex-row gap-8 w-full justify-center border-y border-gray-50 dark:border-gray-800/50 py-6 mb-6">
          <View className="items-center">
            <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Followers</Text>
            <Text className="text-lg font-black dark:text-white">{clan.followerCount?.toLocaleString() || 0}</Text>
          </View>
          <View className="items-center">
            <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Points</Text>
            <Text className="text-lg font-black" style={{ color: activeGlowColor || highlightColor }}>{currentPoints.toLocaleString()}</Text>
          </View>
          <View className="items-center">
            <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Members</Text>
            <Text className="text-lg font-black dark:text-white">{clan.members?.length || 0}/{clan.maxSlots || 5}</Text>
          </View>
        </View>

        {/* Medals Container */}
        <View className="w-full flex-row justify-center items-center gap-2 mb-6">
          {clan.badges?.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 3 }}>
              {clan.badges.map((badgeName, idx) => (
                <ClanBadge key={`${badgeName}-${idx}`} isClanPage={true} badgeName={badgeName} size="sm" />
              ))}
            </ScrollView>
          ) : (
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">No Medals Earned</Text>
          )}
        </View>

        {/* Leadership */}
        <View className="w-full flex-row justify-center mb-8">
          {clan.leader && (
            <View className="flex-row items-center gap-3 bg-gray-50 dark:bg-gray-900 p-2 pr-4 rounded-full border border-gray-100 dark:border-gray-800">
              {/* ⚡️ Fixed invisible image issue with explicit styling */}
              <Image 
                  source={{ uri: clan.leader.profilePic?.url || "https://oreblogda.com/default-avatar.png" }} 
                  contentFit="cover"
                  style={{ width: 32, height: 32, borderRadius: 16 }} 
              />
              <View>
                <Text className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Clan Leader</Text>
                <Text className="text-xs font-bold dark:text-white">{clan.leader.username}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Progress */}
        <View className="w-full">
          <View className="flex-row justify-between mb-2 px-1">
            <Text style={{ color: activeGlowColor || highlightColor }} className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{clan.rankTitle}</Text>
            <Text className="text-[10px] font-mono text-gray-400">{currentPoints} / {nextMilestone}</Text>
          </View>
          <View className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <View style={{ width: `${progress}%`, backgroundColor: activeGlowColor || highlightColor }} className="h-full shadow-lg" />
          </View>
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
          snakeLength={borderVisual.snakeLength || 120}
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

const RemoteSvgIcon = ({ xml, size = 50, color }) => {
    if (!xml) return <MaterialCommunityIcons name="help-circle-outline" size={size} color="gray" />;
    return <SvgXml xml={xml} width={size} height={size} />;
};