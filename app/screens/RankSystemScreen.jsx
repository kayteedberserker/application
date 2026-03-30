import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Dimensions, ScrollView, TouchableOpacity, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../components/Text';
import THEME from '../../components/useAppTheme';
import TopBar from '../../components/Topbar';
const { width } = Dimensions.get('window');

const AURA_PURPLE = "#a78bfa";

// ⚡️ YOUR EXACT AURA TIERS
const AURA_TIERS = [
  { level: 8, req: 12000, title: "Monarch", icon: "👑", postLimit: 6, color: "#facc15" },
  { level: 7, req: 6000, title: "SS-Rank Mythic", icon: "🌀", postLimit: 5, color: "#c084fc" },
  { level: 6, req: 3000, title: "S-Rank Legend", icon: "🌟", postLimit: 5, color: "#a855f7" },
  { level: 5, req: 1500, title: "A-Rank Champion", icon: "🛡️", postLimit: 4, color: "#ef4444" },
  { level: 4, req: 700, title: "B-Rank Elite", icon: "⚡", postLimit: 4, color: "#3b82f6" },
  { level: 3, req: 300, title: "C-Rank Awakened", icon: "🔥", postLimit: 3, color: "#f97316" },
  { level: 2, req: 100, title: "D-Rank Operative", icon: "⚔️", postLimit: 3, color: "#10b981" },
  { level: 1, req: 0, title: "E-Rank Novice", icon: "🌱", postLimit: 2, color: "#94a3b8" },
];

export default function RankSystemScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  
  const RankRow = ({ icon, title, requirement, limit, color, isLast }) => (
    <View 
      style={{ borderBottomColor: THEME.border }}
      className={`flex-row items-center py-5 ${!isLast ? 'border-b' : ''}`}
    >
      <View 
        style={{ backgroundColor: isDark ? `${color}15` : `${color}10`, borderColor: `${color}30` }} 
        className="w-12 h-12 rounded-2xl items-center justify-center border"
      >
        <Text className="text-2xl">{icon}</Text>
      </View>
      <View className="flex-1 ml-4">
        <Text style={{ color: color || THEME.text }} className="font-black italic uppercase text-sm tracking-tight">
          {title}
        </Text>
        <Text style={{ color: THEME.textSecondary || '#64748b' }} className="text-[10px] uppercase font-bold mt-1">
          Requires: {requirement}+ Aura
        </Text>
      </View>
      <View className="items-end">
        <Text style={{ color: THEME.accent }} className="font-black italic text-xs">{limit} PER DAY</Text>
        <Text style={{ color: THEME.textSecondary || '#475569' }} className="text-[7px] uppercase tracking-widest mt-1">Post Protocol</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
      <TopBar isDark={isDark} />
      {/* --- Ambient Background Glows --- */}
      <View style={{ position: 'absolute', top: -100, right: -50, width: 300, height: 300, borderRadius: 150, backgroundColor: THEME.glowBlue }} />
      <View style={{ position: 'absolute', bottom: 100, left: -100, width: 400, height: 400, borderRadius: 200, backgroundColor: THEME.glowOrange }} />

      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        
        {/* --- Header --- */}
        <View className="flex-row items-center mt-8 mb-8">
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={{ backgroundColor: THEME.card, borderColor: THEME.border }}
            className="w-12 h-12 items-center justify-center rounded-2xl border-2"
          >
            <Ionicons name="chevron-back" size={24} color={THEME.accent} />
          </TouchableOpacity>
          <View className="ml-5">
            <Text style={{ color: THEME.accent }} className="text-[10px] font-black uppercase tracking-[0.3em] mb-1">Status Hierarchy</Text>
            <Text style={{ color: THEME.text }} className="text-3xl font-black italic uppercase">Rank & Aura</Text>
          </View>
        </View>

        {/* --- Aura Section --- */}
        <View className="mb-10">
            <View className="flex-row items-center mb-6">
                <MaterialCommunityIcons name="auto-fix" size={20} color={AURA_PURPLE} />
                <Text style={{ color: THEME.text }} className="ml-3 font-black italic uppercase tracking-widest">Aura Power</Text>
            </View>

            <View style={{ backgroundColor: THEME.card, borderColor: AURA_PURPLE + '40' }} className="p-8 rounded-[40px] border-2">
                <View className="items-center mb-6">
                    <View 
                      style={{ backgroundColor: AURA_PURPLE + '15', borderColor: AURA_PURPLE + '30' }} 
                      className="w-16 h-16 rounded-full items-center justify-center border mb-4"
                    >
                        <MaterialCommunityIcons name="shield-star" size={32} color={AURA_PURPLE} />
                    </View>
                    <Text style={{ color: THEME.text }} className="font-black italic uppercase text-center text-lg">Global Standing</Text>
                </View>

                <View className="space-y-4">
                    <Text style={{ color: THEME.textSecondary || '#64748b' }} className="text-sm leading-6">
                        • <Text style={{ color: AURA_PURPLE }} className="font-bold">Aura</Text> represents your total influence and engagement within the community.
                    </Text>
                    <Text style={{ color: THEME.textSecondary || '#64748b' }} className="text-sm leading-6">
                        • Points are earned through <Text className="font-bold dark:text-white">Transmissions</Text>, receiving <Text className="font-bold dark:text-white">Likes</Text>, and active <Text className="font-bold dark:text-white">Discussion</Text>.
                    </Text>
                    <Text style={{ color: THEME.textSecondary || '#64748b' }} className="text-sm leading-6">
                        • Ascending through the ranks unlocks higher <Text className="font-bold dark:text-white">Transmission Limits</Text> and priority in the global algorithm.
                    </Text>
                </View>
            </View>
        </View>

        {/* --- Ranking Section --- */}
        <View className="mb-10">
            <View className="flex-row items-center mb-6">
                <Ionicons name="ribbon-outline" size={18} color={THEME.accent} />
                <Text style={{ color: THEME.text }} className="ml-3 font-black italic uppercase tracking-widest">Authority Levels</Text>
            </View>
            
            <View style={{ backgroundColor: THEME.card, borderColor: THEME.border }} className="p-6 rounded-[35px] border-2">
                {AURA_TIERS.map((tier, index) => (
                    <RankRow 
                        key={tier.level}
                        icon={tier.icon}
                        title={tier.title}
                        requirement={tier.req}
                        limit={tier.postLimit}
                        color={tier.color}
                        isLast={index === AURA_TIERS.length - 1}
                    />
                ))}
            </View>
            <Text style={{ color: THEME.textSecondary || '#475569' }} className="text-[10px] mt-4 font-medium leading-4 px-2 italic text-center">
                High Ranks grant immunity to standard point decay and prioritize content in the moderation queue.
            </Text>
        </View>

        {/* --- Streak Section --- */}
        <View className="mb-10">
            <View className="flex-row items-center mb-6">
                <Ionicons name="flame-outline" size={18} color={THEME.streak || '#f97316'} />
                <Text style={{ color: THEME.text }} className="ml-3 font-black italic uppercase tracking-widest">Streak Protocol</Text>
            </View>

            <View style={{ backgroundColor: THEME.card, borderColor: THEME.border }} className="p-8 rounded-[40px] border-2">
                <View className="items-center mb-6">
                    <View 
                      style={{ backgroundColor: (THEME.streak || '#f97316') + '15', borderColor: (THEME.streak || '#f97316') + '20' }} 
                      className="w-16 h-16 rounded-full items-center justify-center border mb-4"
                    >
                        <Ionicons name="time-outline" size={32} color={THEME.streak || '#f97316'} />
                    </View>
                    <Text style={{ color: THEME.text }} className="font-black italic uppercase text-center text-lg">Transmission Continuity</Text>
                </View>

                <View className="space-y-4">
                    <Text style={{ color: THEME.textSecondary || '#64748b' }} className="text-sm leading-6">
                        • Your streak increments every day you enter a new transmission into the system.
                    </Text>
                    <Text style={{ color: THEME.textSecondary || '#64748b' }} className="text-sm leading-6">
                        • If inactive for more than <Text style={{ color: THEME.streak || '#f97316' }} className="font-bold">48 hours</Text>, your link breaks and the streak is lost.
                    </Text>
                    <Text style={{ color: THEME.textSecondary || '#64748b' }} className="text-sm leading-6">
                        • <Text style={{ color: THEME.text }} className="font-bold">RESTORATION:</Text> Broken streaks can be recovered using OC (Ore Coins) or by viewing authorized sponsor data.
                    </Text>
                </View>
            </View>
        </View>

        {/* --- Warning Section --- */}
        <View 
            style={{ borderColor: "#ef4444", backgroundColor: "#ef4444" + '08' }} 
            className="p-6 rounded-3xl border-2 mb-8"
        >
            <View className="flex-row items-center mb-3">
                <Ionicons name="warning" size={20} color="#ef4444" />
                <Text className="ml-3 font-black italic uppercase text-red-500">Anti-Spam Detection</Text>
            </View>
            <Text style={{ color: THEME.textSecondary || '#64748b' }} className="text-xs leading-5 font-medium">
                "Aura Padding" via low-effort transmissions or automated comments is strictly forbidden. The system will trigger a <Text className="text-red-500 font-bold">RANK RESET</Text> for any operative flagged by the integrity filters.
            </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}