import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Dimensions, SafeAreaView, ScrollView, TouchableOpacity, View } from 'react-native';
import { Text } from '../../components/Text';
import THEME from '../../components/useAppTheme';
const { width } = Dimensions.get('window');

export default function RankSystemScreen() {
  const router = useRouter();

  const RankRow = ({ icon, title, count, limit, isLast }) => (
    <View 
      style={{ borderBottomColor: THEME.border }}
      className={`flex-row items-center py-5 ${!isLast ? 'border-b' : ''}`}
    >
      {/* Icon Box: Changed from bg-gray-900 to THEME.card to match theme */}
      <View 
        style={{ backgroundColor: THEME.bg, borderColor: THEME.border }} 
        className="w-12 h-12 rounded-2xl items-center justify-center border"
      >
        <Text className="text-2xl">{icon}</Text>
      </View>
      <View className="flex-1 ml-4">
        <Text style={{ color: THEME.text }} className="font-black italic uppercase text-sm tracking-tight">
          {title.replace('_', ' ')}
        </Text>
        <Text style={{ color: THEME.textSecondary || '#64748b' }} className="text-[10px] uppercase font-bold mt-1">
          Requirement: {count}+ Posts
        </Text>
      </View>
      <View className="items-end">
        <Text style={{ color: THEME.accent }} className="font-black italic text-xs">{limit} POSTS/DAY</Text>
        <Text style={{ color: THEME.textSecondary || '#475569' }} className="text-[8px] uppercase tracking-widest mt-1">Limit Protocol</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
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
            <Text style={{ color: THEME.text }} className="text-3xl font-black italic uppercase">Rank & Streaks</Text>
          </View>
        </View>

        {/* --- Ranking Section --- */}
        <View className="mb-10">
            <View className="flex-row items-center mb-6">
                <Ionicons name="ribbon-outline" size={18} color={THEME.accent} />
                <Text style={{ color: THEME.text }} className="ml-3 font-black italic uppercase tracking-widest">Authority Levels</Text>
            </View>
            
            <View style={{ backgroundColor: THEME.card, borderColor: THEME.border }} className="p-6 rounded-[35px] border-2">
                <RankRow icon="👑" title="Master_Writer" count={200} limit={10} />
                <RankRow icon="💎" title="Elite_Writer" count={151} limit={7} />
                <RankRow icon="🔥" title="Senior_Writer" count={101} limit={7} />
                <RankRow icon="⚔️" title="Novice_Writer" count={51} limit={5} />
                <RankRow icon="📜" title="Senior_Researcher" count={26} limit={5} />
                <RankRow icon="🛡️" title="Novice_Researcher" count={0} limit={3} isLast />
            </View>
            <Text style={{ color: THEME.textSecondary || '#475569' }} className="text-[10px] mt-4 font-medium leading-4 px-2 italic">
                Higher ranks unlock increased daily post limits and prioritize your content in the moderation queue.
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
                    <Text style={{ color: THEME.text }} className="font-black italic uppercase text-center text-lg">48-Hour Lifecycle</Text>
                </View>

                <View className="space-y-4">
                    <Text style={{ color: THEME.textSecondary || '#64748b' }} className="text-sm leading-6">
                        • Streaks activate immediately upon your first transmission.
                    </Text>
                    <Text style={{ color: THEME.textSecondary || '#64748b' }} className="text-sm leading-6">
                        • Post daily to increment your multiplier. If inactive for <Text style={{ color: THEME.streak || '#f97316' }} className="font-bold">48 hours</Text>, the streak expires.
                    </Text>
                    <Text style={{ color: THEME.textSecondary || '#64748b' }} className="text-sm leading-6">
                        • <Text style={{ color: THEME.text }} className="font-bold">RESTORATION:</Text> Expired streaks can be recovered once by watching an authorized advertisement.
                    </Text>
                </View>
            </View>
        </View>

        {/* --- Warning / Anti-Spam Section --- */}
        <View 
            style={{ borderColor: "#ef4444", backgroundColor: "#ef4444" + '08' }} 
            className="p-6 rounded-3xl border-2 mb-8"
        >
            <View className="flex-row items-center mb-3">
                <Ionicons name="warning" size={20} color="#ef4444" />
                <Text className="ml-3 font-black italic uppercase text-red-500">Anti-Spam Detection</Text>
            </View>
            <Text style={{ color: THEME.textSecondary || '#64748b' }} className="text-xs leading-5 font-medium">
                The system monitors "Streak Padding." Users submitting multiple low-effort posts that result in rejections will have their streak <Text className="text-red-500 font-bold">PERMANENTLY RESET</Text> to zero. Restoration protocols will be disabled for flagged accounts.
            </Text>
        </View>

        {/* --- Credibility Footer --- */}
        <View className="items-center mt-4">
            <Text style={{ color: THEME.textSecondary || '#334155' }} className="text-center text-[10px] font-black uppercase tracking-[0.2em] leading-4">
                High Ranks + Active Streaks ={"\n"}
                <Text style={{ color: THEME.accent }}>MAXIMUM APPROVAL CREDIBILITY</Text>
            </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
