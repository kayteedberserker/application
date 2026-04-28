import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from 'react-native';
import AuraAvatar from "./AuraAvatar";
import ClanBorder from "./ClanBorder";
import PlayerBackground from "./PlayerBackground";
import PlayerNameplate from "./PlayerNameplate";
import PlayerWatermark from "./PlayerWatermark";
import { Text } from "./Text";
import TitleTag from "./TitleTag";

const getAuraTier = (rank) => {
  const MONARCH_GOLD = '#fbbf24';
  const CRIMSON_RED = '#ef4444';
  const SHADOW_PURPLE = '#a855f7';
  const STEEL_BLUE = '#3b82f6';
  const REI_WHITE = '#e0f2fe';

  if (!rank || rank > 10 || rank <= 0) return { color: '#3b82f6', label: 'ACTIVE', icon: 'radar' };
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

export const AURA_TIERS = [
  { level: 1, req: 0, title: "E-Rank Novice", icon: "🌱", color: "#94a3b8" },
  { level: 2, req: 100, title: "D-Rank Operative", icon: "⚔️", color: "#34d399" },
  { level: 3, req: 300, title: "C-Rank Awakened", icon: "🔥", color: "#f87171" },
  { level: 4, req: 700, title: "B-Rank Elite", icon: "⚡", color: "#a78bfa" },
  { level: 5, req: 1500, title: "A-Rank Champion", icon: "🛡️", color: "#60a5fa" },
  { level: 6, req: 3000, title: "S-Rank Legend", icon: "🌟", color: "#fcd34d" },
  { level: 7, req: 6000, title: "SS-Rank Mythic", icon: "🌀", color: "#f472b6" },
  { level: 8, req: 12000, title: "Monarch", icon: "👑", color: "#fbbf24" },
];

const resolveUserRank = (level, currentAura) => {
  const safeLevel = Math.max(1, Math.min(8, level || 1));
  const currentTier = AURA_TIERS[safeLevel - 1];
  const nextTier = AURA_TIERS[safeLevel] || currentTier;

  let progress = 100;
  if (safeLevel < 8) {
    progress = ((currentAura - currentTier.req) / (nextTier.req - currentTier.req)) * 100;
  }

  return {
    title: currentTier.title.toUpperCase().replace(/ /g, "_"),
    icon: currentTier.icon,
    color: currentTier.color,
    progress: Math.min(Math.max(progress, 0), 100),
    req: currentTier.req,
    nextReq: nextTier.req
  }
};

export default function PlayerCard({ author, totalPosts, isDark }) {
  if (!author) return null;

  const totalAura = author.aura || 0;
  const rankLevel = author.currentRankLevel || 1;
  const writerRank = resolveUserRank(rankLevel, totalAura);

  const weeklyGloryRank = author?.previousRank || 0;
  const equippedTitle = author?.equippedTitle || null;
  const weeklyAuraTier = getAuraTier(weeklyGloryRank);

  const equippedGlow = author?.inventory?.find(i => i.category === 'GLOW' && i.isEquipped);
  const equippedBg = author.inventory?.find(i => i.category === 'BACKGROUND' && i.isEquipped);
  const equippedBorder = author.inventory?.find(i => i.category === 'BORDER' && i.isEquipped);
  const equippedWatermark = author.inventory?.find(i => i.category === 'WATERMARK' && i.isEquipped);

  const equippedBadges = author.inventory?.filter(i => i.category === 'BADGE' && i.isEquipped).slice(0, 10) || [];

  const themeColor = equippedGlow?.visualConfig?.primaryColor || weeklyAuraTier.color;
  const favoriteCharacter = author?.preferences?.favCharacter || "NONE_SET";
  const displayId = author.deviceId ? author.deviceId.slice(-11).toUpperCase() : "OP_882749112";

  const CardContent = (
    <View
      className="relative p-8 bg-white dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-800 overflow-hidden shadow-2xl"
      style={{ borderRadius: 27, width: 372 }}
    >
      <PlayerBackground equippedBg={equippedBg} themeColor={themeColor} borderRadius={27} />
      <PlayerWatermark equippedWatermark={equippedWatermark} isDark={isDark} />

      <View className="flex-row justify-between items-center mb-6 opacity-40 relative z-10">
        <Text className="text-[15px] font-black tracking-[0.6em] text-gray-500 dark:text-gray-400">PLAYER CARD</Text>
        <View className="flex-row gap-1.5">
          <View className="w-1.5 h-1.5 rounded-full bg-gray-400" />
          <View className="w-1.5 h-1.5 rounded-full bg-gray-400" />
          <View className="w-10 h-1.5 rounded-full bg-gray-400" />
        </View>
      </View>

      {/* ⚡️ FIXED: Added w-full and centered everything perfectly inside */}
      <View className="flex-col items-center w-full relative z-10">
        <View className="relative items-center justify-center mb-4">
          <AuraAvatar
            author={{ ...author, rank: weeklyGloryRank, image: author.profilePic?.url, name: author.username }}
            aura={weeklyAuraTier}
            glowColor={equippedGlow?.visualConfig?.primaryColor}
            isTop10={weeklyGloryRank > 0 && weeklyGloryRank <= 10}
            isDark={isDark}
            size={150}
          />
          <View className={`absolute bottom-0 ${weeklyGloryRank > 0 && weeklyGloryRank <= 10 ? 'z-20' : 'z-10'}`}>
            <TitleTag key={equippedTitle} rank={weeklyGloryRank} size={13} auraVisuals={weeklyAuraTier} equippedTitle={equippedTitle} isTop10={weeklyGloryRank > 0 && weeklyGloryRank < 10} />
          </View>
        </View>

        <View className="items-center w-full">
          <View className="flex-row w-full items-center justify-center">
            <PlayerNameplate
              author={author}
              themeColor={themeColor}
              equippedGlow={equippedGlow}
              auraRank={weeklyGloryRank}
              isDark={isDark}
              showFlame={true}
              showPeakBadge={true}
              fontSize={28}
            />
          </View>

          {/* {equippedBadges.length > 0 && (
            <View className="flex-row flex-wrap justify-center gap-2 mt-3 mb-3">
              {equippedBadges.map((badge, bIdx) => (
                <BadgeIcon key={`spec-${bIdx}`} badge={badge} size={22} isDark={isDark} />
              ))}
            </View>
          )} */}

          <Text className="text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed font-medium px-4 italic mb-5 mt-2">
            "{author.description || "This operator is a ghost in the machine..."}"
          </Text>

          <View className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl px-5 py-2.5 flex-row items-center justify-center self-center mb-3">
            <MaterialCommunityIcons name="shield-star-outline" size={16} color={themeColor} />
            <Text className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-2">GOAT:</Text>
            <Text className="text-[11px] font-black uppercase tracking-widest text-gray-900 dark:text-white ml-2 italic">
              {favoriteCharacter}
            </Text>
          </View>

          <View className="flex-row justify-between w-full mt-4 border-y border-gray-100 dark:border-gray-800 py-5 px-2">
            <View className="items-center flex-1">
              <Text className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1">Aura</Text>
              <Text className="text-xl font-black" style={{ color: writerRank.color }}>{totalAura}</Text>
            </View>
            <View className="items-center flex-1 border-l border-gray-100 dark:border-gray-800">
              <Text className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1">Glory</Text>
              <Text className="text-xl font-black" style={{ color: '#ec4899' }}>+{author.weeklyAura || 0}</Text>
            </View>
            <View className="items-center flex-1 border-l border-gray-100 dark:border-gray-800">
              <Text className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1">Docs</Text>
              <Text className="text-xl font-black dark:text-white">{totalPosts}</Text>
            </View>
          </View>

          <View className="mt-8 w-full px-2">
            <View className="flex-row justify-between items-end mb-3 px-1">
              <View className="flex-row items-center gap-3">
                <Text className="text-3xl">{writerRank.icon}</Text>
                <View>
                  <Text style={{ color: writerRank.color }} className="text-[9px] font-mono uppercase tracking-[0.2em] leading-none mb-1">PLAYER_CLASS</Text>
                  <Text className="text-xs font-black uppercase tracking-widest dark:text-white">
                    {writerRank.title}
                  </Text>
                </View>
              </View>
              <Text className="text-[10px] font-mono font-bold text-gray-500 uppercase mb-1">
                EXP: {totalAura} / {writerRank.nextReq}
              </Text>
            </View>

            <View className="h-2 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
              <View style={{ width: `${writerRank.progress}%`, backgroundColor: writerRank.color }} className="h-full" />
            </View>
          </View>
        </View>

        <View className="w-full mt-8 pt-5 border-t border-dashed border-gray-200 dark:border-gray-800 flex-row justify-between items-center">
          <View className="flex-row gap-1">
            <View className="w-4 h-1 bg-gray-200 dark:bg-gray-800 rounded-full" />
            <View className="w-2 h-1 bg-gray-200 dark:bg-gray-800 rounded-full" />
          </View>
          <Text className="text-[10px] font-mono text-gray-400 dark:text-gray-500 uppercase tracking-tighter">
            SERIAL: {displayId}
          </Text>
        </View>
      </View>
    </View>
  );

  const borderVisual = equippedBorder?.visualConfig || {};
  return equippedBorder ? (
    <ClanBorder
      color={borderVisual.primaryColor || themeColor}
      secondaryColor={borderVisual.secondaryColor || null}
      animationType={borderVisual.animationType || "singleSnake"}
      snakeLength={borderVisual.snakeLength || 400}
      duration={borderVisual.duration || 3000}
    >
      {CardContent}
    </ClanBorder>
  ) : (
    CardContent
  );
}