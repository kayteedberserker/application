import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop, SvgXml } from "react-native-svg";
import AuraAvatar from "./AuraAvatar"; 
import ClanBorder from "./ClanBorder"; 
import { Text } from "./Text"; 
// ⚡️ Imported Peak Badge
import PeakBadge from "./PeakBadge";

// Utility logic kept inside the component for portability
const getAuraTier = (rank) => {
  const MONARCH_GOLD = '#fbbf24';
  const CRIMSON_RED = '#ef4444';
  const SHADOW_PURPLE = '#a855f7';
  const STEEL_BLUE = '#3b82f6';
  const REI_WHITE = '#e0f2fe';

  if (!rank || rank > 10 || rank <= 0) {
    return { color: '#3b82f6', label: 'ACTIVE', icon: 'radar' };
  }

  switch (rank) {
    case 1: return { color: MONARCH_GOLD, label: 'MONARCH', icon: 'crown' };
    case 2: return { color: CRIMSON_RED, label: 'YONKO', icon: 'flare' };
    case 3: return { color: SHADOW_PURPLE, label: 'KAGE', icon: 'moon-waxing-crescent' };
    case 4: return { color: STEEL_BLUE, label: 'SHOGUN', icon: 'shield-star' };
    case 5: return { color: REI_WHITE, label: 'ESPADA 0', icon: 'skull' };
    case 6: return { color: '#cbd5e1', label: 'ESPADA 1', icon: 'sword-cross' };
    case 7: return { color: '#94a3b8', label: 'ESPADA 2', icon: 'sword-cross' };
    case 8: return { color: '#64748b', label: 'ESPADA 3', icon: 'sword-cross' };
    case 9: return { color: '#475569', label: 'ESPADA 4', icon: 'sword-cross' };
    case 10: return { color: '#334155', label: 'ESPADA 5', icon: 'sword-cross' };
    default: return { color: '#1e293b', label: 'VANGUARD', icon: 'shield-check' };
  }
};

/**
 * PlayerCard is now a standard functional component.
 * To capture this, wrap it in <ViewShot> in the parent page (profile.jsx).
 */
export default function PlayerCard({ author, totalPosts, isDark }) {
  if (!author) return null;

  const count = totalPosts;
  const rankTitle = count > 200 ? "Master_Writer" : count > 150 ? "Elite_Writer" : count > 100 ? "Senior_Writer" : count > 50 ? "Novice_Writer" : count > 25 ? "Senior_Researcher" : "Novice_Researcher";
  const rankIcon = count > 200 ? "👑" : count > 150 ? "💎" : count > 100 ? "🔥" : count > 50 ? "⚔️" : count > 25 ? "📜" : "🛡️";
  const nextMilestone = count > 200 ? 500 : count > 150 ? 200 : count > 100 ? 150 : count > 50 ? 100 : count > 25 ? 50 : 25;
  const progress = Math.min((count / nextMilestone) * 100, 100);

  const auraRank = author?.previousRank || 0;
  const aura = getAuraTier(auraRank);

  // --- 🎨 Unified Theme Color Logic ---
  const equippedGlow = author?.inventory?.find(i => i.category === 'GLOW' && i.isEquipped);
  const activeGlowColor = equippedGlow?.visualConfig?.primaryColor || null;
  const themeColor = activeGlowColor || aura.color;

  const equippedBg = author.inventory?.find(i => i.category === 'BACKGROUND' && i.isEquipped);
  const bgVisual = equippedBg?.visualConfig || {};

  const equippedBorder = author.inventory?.find(i => i.category === 'BORDER' && i.isEquipped);
  const borderVisual = equippedBorder?.visualConfig || {};

  const equippedWatermark = author.inventory?.find(i => i.category === 'WATERMARK' && i.isEquipped);
  const watermarkVisual = equippedWatermark?.visualConfig || {};

  // Fetching the favorite character from preferences
  const favoriteCharacter = author?.preferences?.favCharacter || "NONE_SET";

  // Get last 11 characters of device ID
  const displayId = author.deviceId ? author.deviceId.slice(-11).toUpperCase() : "OP_882749112";

  const SpecialWatermark = () => {
    if (!equippedWatermark) return null;
    const iconSize = watermarkVisual.size || 220;
    const iconColor = watermarkVisual.color || (isDark ? 'white' : 'black');
    return (
      <View className="absolute" style={{ bottom: -20, right: -20, opacity: 0.7, transform: [{ rotate: watermarkVisual.rotation || '-15deg' }] }} pointerEvents="none">
        {watermarkVisual.svgCode ? (
          <SvgXml xml={watermarkVisual.svgCode.replace(/currentColor/g, iconColor)} width={iconSize} height={iconSize} />
        ) : (
          <MaterialCommunityIcons name={watermarkVisual.icon || 'fountain-pen-tip'} size={iconSize} color={iconColor} />
        )}
      </View>
    );
  };

  const CardContent = (
    <View
      className="relative p-8 bg-white dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-800 overflow-hidden shadow-2xl"
      style={{ borderRadius: 48, width: 380 }} // Increased width and border radius
    >
      {/* Background Aura Glow */}
      <View
        className="absolute -top-10 -right-10 w-72 h-72 opacity-10 rounded-full blur-3xl"
        style={{ backgroundColor: themeColor }}
      />
      
      <SpecialWatermark />

      {/* SVG Background Layer */}
      {equippedBg && (
        <View className="absolute inset-0" style={{ borderRadius: 48, overflow: 'hidden' }}>
          <Svg height="100%" width="100%">
            <Defs>
              <LinearGradient id="playerCardGrad" x1="0%" y1="0%" x2="100%" >
                <Stop offset="0%" stopColor={bgVisual.primaryColor || themeColor} stopOpacity={0.15} />
                <Stop offset="100%" stopColor={bgVisual.secondaryColor || bgVisual.primaryColor || themeColor} stopOpacity={0.02} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#playerCardGrad)" />
          </Svg>
        </View>
      )}

      {/* ID Header Decoration */}
      <View className="flex-row justify-between items-center mb-6 opacity-40 relative z-10">
        <Text className="text-[15px] font-black tracking-[0.6em] text-gray-500 dark:text-gray-400">PLAYER CARD</Text>
        <View className="flex-row gap-1.5">
          <View className="w-1.5 h-1.5 rounded-full bg-gray-400" />
          <View className="w-1.5 h-1.5 rounded-full bg-gray-400" />
          <View className="w-10 h-1.5 rounded-full bg-gray-400" />
        </View>
      </View>

      <View className="flex-col items-center gap-6 relative z-10">
        <View className="relative items-center justify-center">
          <AuraAvatar
            author={{
              ...author,
              rank: auraRank,
              image: author.profilePic?.url,
              name: author.username
            }}
            aura={aura}
            glowColor={activeGlowColor}
            isTop10={auraRank > 0 && auraRank <= 10}
            isDark={isDark}
            size={150} // Slightly larger avatar
          />

          {auraRank > 0 && (
            <View
              style={{ backgroundColor: themeColor }}
              className="absolute -bottom-4 px-5 py-1.5 rounded-full border-2 border-white dark:border-black shadow-lg z-20"
            >
              <View className="flex-row items-center gap-1.5">
                <MaterialCommunityIcons name={aura.icon} size={12} color={auraRank === 5 || activeGlowColor ? "black" : "white"} />
                <Text
                  style={{ color: auraRank === 5 || activeGlowColor ? "black" : "white" }}
                  className="text-[10px] font-black uppercase tracking-widest"
                >
                  {aura.label} #{auraRank}
                </Text>
              </View>
            </View>
          )}
        </View>

        <View className="items-center w-full mt-4">
          
          {/* ⚡️ Peak Badge & Username Row */}
          <View className="flex-row items-center gap-2 mb-2">
            <Text
              style={{
                textShadowColor: themeColor,
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: (auraRank <= 2 || activeGlowColor) ? 10 : 0
              }}
              className="text-4xl font-black italic tracking-tighter uppercase text-gray-900 dark:text-white text-center"
            >
              {author.username}
            </Text>

            {/* Render PeakBadge inline if the author has a Peak Level > 0 */}
            {(author.peakLevel && author.peakLevel > 0) ? (
                <View className="-mt-1 ml-2">
                    <PeakBadge level={author.peakLevel} size={28} />
                </View>
            ) : null}

            {/* Streak Counter moved to the right of the name/badge */}
            <View className="flex-row items-center bg-orange-500/10 px-2.5 py-1 rounded-lg ml-1">
              <Ionicons name="flame" size={18} color="#f97316" />
              <Text className="text-orange-500 font-black ml-1 text-sm">{author.lastStreak || "0"}</Text>
            </View>
          </View>

          <Text className="text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed font-medium px-6 italic mb-5">
            "{author.description || "This operator is a ghost in the machine..."}"
          </Text>

          {/* Favorite Character Field */}
          <View className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl px-5 py-2.5 flex-row items-center mb-3">
            <MaterialCommunityIcons name="shield-star-outline" size={16} color={themeColor} />
            <Text className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-2">GOAT:</Text>
            <Text className="text-[11px] font-black uppercase tracking-widest text-gray-900 dark:text-white ml-2 italic">
              {favoriteCharacter}
            </Text>
          </View>

          <View className="flex-row gap-10 mt-4 border-y border-gray-100 dark:border-gray-800 w-full py-5 justify-center">
            <View className="items-center">
              <Text className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Aura</Text>
              <Text className="text-xl font-black" style={{ color: themeColor }}>+{author.weeklyAura || 0}</Text>
            </View>
            <View className="items-center">
              <Text className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Logs</Text>
              <Text className="text-xl font-black dark:text-white">{totalPosts}</Text>
            </View>
            <View className="items-center">
              <Text className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Rank</Text>
              <Text className="text-xl font-black dark:text-white" style={{ color: themeColor }}>#{auraRank || '??'}</Text>
            </View>
          </View>

          <View className="mt-10 w-full px-2">
            <View className="flex-row justify-between items-end mb-2.5">
              <View className="flex-row items-center gap-2">
                <Text className="text-3xl">{rankIcon}</Text>
                <View>
                  <Text style={{ color: themeColor }} className="text-[9px] font-mono uppercase tracking-[0.2em] leading-none mb-1">Writer_Class</Text>
                  <Text className="text-base font-black uppercase tracking-tighter dark:text-white">
                    {rankTitle}
                  </Text>
                </View>
              </View>
              <Text className="text-[11px] font-mono font-bold text-gray-500 uppercase">
                EXP: {count} / {nextMilestone}
              </Text>
            </View>

            <View className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <View
                style={{ width: `${progress}%`, backgroundColor: themeColor }}
                className="h-full shadow-lg shadow-blue-500"
              />
            </View>
          </View>
        </View>
      </View>

      {/* Bottom ID Strip */}
      <View className="mt-8 pt-5 border-t border-dashed border-gray-200 dark:border-gray-800 flex-row justify-between items-center relative z-10">
        <View className="flex-row gap-1">
          <View className="w-4 h-1 bg-gray-200 dark:bg-gray-800 rounded-full" />
          <View className="w-2 h-1 bg-gray-200 dark:bg-gray-800 rounded-full" />
        </View>
        <Text className="text-[10px] font-mono text-gray-400 dark:text-gray-500 uppercase tracking-tighter">
          SERIAL: {displayId}
        </Text>
      </View>
    </View>
  );

  return equippedBorder ? (
    <ClanBorder
      color={borderVisual.primaryColor || themeColor}
      secondaryColor={borderVisual.secondaryColor || null}
      animationType={borderVisual.animationType || "singleSnake"}
      snakeLength={borderVisual.snakeLength || 120}
      duration={borderVisual.duration || 3000}
    >
      {CardContent}
    </ClanBorder>
  ) : (
    CardContent
  );
}