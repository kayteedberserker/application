import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from 'react-native';
import AuraAvatar from "./AuraAvatar"; 
import ClanBorder from "./ClanBorder"; 
import { Text } from "./Text"; 
// ⚡️ Imported the newly extracted components
import PlayerBackground from "./PlayerBackground";
import PlayerNameplate from "./PlayerNameplate";
import PlayerWatermark from "./PlayerWatermark";
import BadgeIcon from "./BadgeIcon"; // ⚡️ Make sure this is imported!

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

export default function PlayerCard({ author, totalPosts, isDark }) {
  if (!author) return null;
  
  const count = totalPosts;
  const rankTitle = count > 200 ? "Master_Writer" : count > 150 ? "Elite_Writer" : count > 100 ? "Senior_Writer" : count > 50 ? "Novice_Writer" : count > 25 ? "Senior_Researcher" : "Novice_Researcher";
  const rankIcon = count > 200 ? "👑" : count > 150 ? "💎" : count > 100 ? "🔥" : count > 50 ? "⚔️" : count > 25 ? "📜" : "🛡️";
  const nextMilestone = count > 200 ? 500 : count > 150 ? 200 : count > 100 ? 150 : count > 50 ? 100 : count > 25 ? 50 : 25;
  const progress = Math.min((count / nextMilestone) * 100, 100);

  const auraRank = author?.previousRank || 0;
  const aura = getAuraTier(auraRank);

  // --- Inventory Parsing ---
  const equippedGlow = author?.inventory?.find(i => i.category === 'GLOW' && i.isEquipped);
  const equippedBg = author.inventory?.find(i => i.category === 'BACKGROUND' && i.isEquipped);
  const equippedBorder = author.inventory?.find(i => i.category === 'BORDER' && i.isEquipped);
  const equippedWatermark = author.inventory?.find(i => i.category === 'WATERMARK' && i.isEquipped);
  
  // ⚡️ EXTRACT UP TO 10 EQUIPPED BADGES
  const equippedBadges = author.inventory?.filter(i => i.category === 'BADGE' && i.isEquipped).slice(0, 10) || [];
  
  const themeColor = equippedGlow?.visualConfig?.primaryColor || aura.color;
  const favoriteCharacter = author?.preferences?.favCharacter || "NONE_SET";
  const displayId = author.deviceId ? author.deviceId.slice(-11).toUpperCase() : "OP_882749112";

  const CardContent = (
    <View
      className="relative p-8 bg-white dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-800 overflow-hidden shadow-2xl"
      style={{ borderRadius: 27, width: 372 }}
    >
      {/* ⚡️ Extracted Components */}
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

      <View className="flex-col items-center gap-6 relative z-10">
        <View className="relative items-center justify-center">
          <AuraAvatar
            author={{ ...author, rank: auraRank, image: author.profilePic?.url, name: author.username }}
            aura={aura}
            glowColor={equippedGlow?.visualConfig?.primaryColor}
            isTop10={auraRank > 0 && auraRank <= 10}
            isDark={isDark}
            size={150} 
          />
          {auraRank > 0 && (
            <View style={{ backgroundColor: themeColor }} className="absolute -bottom-4 px-5 py-1.5 rounded-full border-2 border-white dark:border-black shadow-lg z-20">
              <View className="flex-row items-center gap-1.5">
                <MaterialCommunityIcons name={aura.icon} size={12} color={auraRank === 5 || equippedGlow ? "black" : "white"} />
                <Text style={{ color: auraRank === 5 || equippedGlow ? "black" : "white" }} className="text-[10px] font-black uppercase tracking-widest">
                  {aura.label} #{auraRank}
                </Text>
              </View>
            </View>
          )}
        </View>

        <View className="items-center flex-shrink-1 flex-wrap w-full mt-4">
          
          {/* ⚡️ PlayerNameplate */}
          <PlayerNameplate 
              author={author} 
              themeColor={themeColor} 
              equippedGlow={equippedGlow}
              auraRank={auraRank}
              isDark={isDark}
              showFlame={true}
              showPeakBadge={true}
              fontSize={28}
          />

          {/* ⚡️ EQUIPPED BADGES ROW (MAX 10) */}
          {equippedBadges.length > 0 && (
              <View className="flex-row flex-wrap justify-center gap-2 mt-2 mb-3">
                  {equippedBadges.map((badge, bIdx) => (
                      <BadgeIcon key={`spec-${bIdx}`} badge={badge} size={22} isDark={isDark} />
                  ))}
              </View>
          )}

          <Text className="text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed font-medium px-6 italic mb-5 mt-2">
            "{author.description || "This operator is a ghost in the machine..."}"
          </Text>

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
              <View style={{ width: `${progress}%`, backgroundColor: themeColor }} className="h-full shadow-lg shadow-blue-500" />
            </View>
          </View>
        </View>
      </View>

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