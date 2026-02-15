import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView, ScrollView, TouchableOpacity, View } from "react-native";
import ClanCrest from "../../components/ClanCrest"; // Assuming path
import { Text } from "../../components/Text";
import THEME from "../../components/useAppTheme";

export default function ClanInfoScreen() {
  const router = useRouter();

  const RankRow = ({ rank, threshold, allowance, color, title }) => (
    <View style={{ borderColor: THEME.border }} className="flex-row items-center justify-between py-4 border-b border-dashed">
      <View className="flex-row items-center">
        {/* Small animated crest for the list */}
        <View className="mr-4">
            <ClanCrest rank={rank} size={45} isFeed={true} />
        </View>
        <View>
            <Text style={{ color }} className="text-[10px] font-black uppercase tracking-tighter italic">{title}</Text>
            <Text style={{ color: THEME.text }} className="text-[12px] font-black uppercase italic">Tier {rank}</Text>
        </View>
      </View>
      <View className="items-end">
        <Text style={{ color: THEME.textSecondary }} className="text-[10px] font-bold">{threshold.toLocaleString()} XP</Text>
        <Text style={{ color: "#10b981" }} className="text-[10px] font-black">+{allowance}/DAY</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        
        {/* --- Header with Top Padding --- */}
        <View className="flex-row items-center mt-10 mb-8">
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={{ backgroundColor: THEME.card, borderColor: THEME.border }}
            className="w-12 h-12 items-center justify-center rounded-2xl border-2 shadow-lg"
          >
            <Ionicons name="chevron-back" size={24} color={THEME.accent} />
          </TouchableOpacity>
          <View className="ml-5">
            <Text style={{ color: "#ec4899" }} className="text-[10px] font-black uppercase tracking-[0.3em] mb-1">Combat Intel</Text>
            <Text style={{ color: THEME.text }} className="text-3xl font-black italic uppercase tracking-tighter">Clan Systems</Text>
          </View>
        </View>

        {/* --- 1. THE CORE HIERARCHY --- */}
        <Text className="text-gray-600 font-black uppercase text-[9px] tracking-[0.2em] mb-4 ml-1">Power Scaling</Text>
        <View style={{ backgroundColor: THEME.card, borderColor: THEME.border }} className="p-6 rounded-[32px] border-2 mb-8 shadow-2xl">
          <RankRow rank={6} title="The Akatsuki" threshold={300000} allowance={5000} color="#ef4444" />
          <RankRow rank={5} title="The Espada" threshold={100000} allowance={2500} color="#e0f2fe" />
          <RankRow rank={4} title="Phantom Troupe" threshold={50000} allowance={1000} color="#a855f7" />
          <RankRow rank={3} title="Upper Moon" threshold={20000} allowance={600} color="#60a5fa" />
          <RankRow rank={2} title="Squad 13" threshold={5000} allowance={300} color="#10b981" />
          <RankRow rank={1} title="Wandering Ronin" threshold={0} allowance={150} color="#94a3b8" />
          
          <View className="mt-6 p-4 rounded-2xl bg-black/40 border border-white/5">
             <Text style={{ color: THEME.textSecondary }} className="text-[9px] leading-4 italic font-bold uppercase">
               ⚠️ Warning: System enforces 10% weekly point decay. Clans inactive for 7 cycles face 50% resource depletion.
             </Text>
          </View>
        </View>

        {/* --- 2. WARFARE PROTOCOL --- */}
        <Text className="text-gray-600 font-black uppercase text-[9px] tracking-[0.2em] mb-4 ml-1">War & Bounty State</Text>
        <View style={{ backgroundColor: '#ef444408', borderColor: '#ef444440' }} className="p-6 rounded-[32px] border-2 mb-8">
          <View className="flex-row items-center mb-5">
             <View className="w-10 h-10 rounded-full bg-red-500 items-center justify-center shadow-lg shadow-red-500/50">
                <Ionicons name="flash" size={20} color="white" />
             </View>
             <Text className="text-red-500 font-black italic uppercase ml-4 text-xl">Active War Protocol</Text>
          </View>
          
          <View className="space-y-4">
            <WarInfoItem 
              title="Escrow Lock" 
              desc="Points staked in war are moved to Locked State until a winner is declared." 
              icon="lock-closed"
            />
            <WarInfoItem 
              title="Bounty System" 
              desc="Target clans with System or Player-placed bounties for massive rewards." 
              icon="skull"
            />
            <WarInfoItem 
              title="Engagement Metrics" 
              desc="Victory is calculated via Points, Likes, or Comments over 3-7 day spans." 
              icon="analytics"
            />
          </View>
        </View>

        {/* --- 3. LEGENDARY BADGES --- */}
        <View className="flex-row justify-between items-center mb-4 px-1">
            <Text className="text-gray-600 font-black uppercase text-[9px] tracking-[0.2em]">Achievement Titles</Text>
            <Text style={{ color: THEME.accent }} className="text-[9px] font-black uppercase italic">Scroll for more</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-12">
          <BadgeItem icon="crown" title="Pirate King" sub="Rank #1 Clan" color="#eab308" />
          <BadgeItem icon="lightning-bolt" title="Gear 2nd" sub="2.0X Growth" color="#ef4444" />
          <BadgeItem icon="shield-sword" title="Gotei 13" sub="10+ Members" color="#a855f7" />
          <BadgeItem icon="library" title="Ohara" sub="1K+ Posts" color="#3b82f6" />
          <BadgeItem icon="eye" title="Sage Mode" sub="High Activity" color="#10b981" />
          <BadgeItem icon="dna" title="Zenkai" sub="1.5X Growth" color="#f472b6" />
          <BadgeItem icon="auto-fix" title="Talk-no-jutsu" sub="Most Discussed" color="#fbbf24" />
          <BadgeItem icon="infinity" title="Unlimited Chakra" sub="4 Wks Stable" color="#2dd4bf" />
          <BadgeItem icon="fire" title="Final Form" sub="Rank 6 Achieved" color="#f87171" />
        </ScrollView>

        {/* --- 4. SCOUTER SYSTEM --- */}
        <Text className="text-gray-600 font-black uppercase text-[9px] tracking-[0.2em] mb-4 ml-1">Intelligence Gear</Text>
        <View style={{ backgroundColor: THEME.card, borderColor: THEME.border }} className="p-6 rounded-[32px] border-2 mb-20 relative overflow-hidden">
           <View className="absolute -right-4 -top-4 opacity-10">
              <MaterialCommunityIcons name="target" size={100} color={THEME.accent} />
           </View>
           <Text style={{ color: THEME.text }} className="text-lg font-black italic uppercase mb-2">Scouter Link</Text>
           <Text style={{ color: THEME.textSecondary }} className="text-[10px] mb-6 leading-4">
              Analyzing follower counts to determine combat effectiveness:
           </Text>
           
           <View className="flex-row items-center justify-between">
              <ScouterNode label="Lvl 1-4" val="Base" color={THEME.textSecondary} />
              <Ionicons name="chevron-forward" size={12} color={THEME.border} />
              <ScouterNode label="Broken Scale" val="80K" color="#ef4444" />
              <Ionicons name="chevron-forward" size={12} color={THEME.border} />
              <ScouterNode label="Over 9000" val="100K" color="#ef4444" glow />
           </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function WarInfoItem({ title, desc, icon }) {
    return (
        <View className="flex-row mb-5">
            <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }} className="w-8 h-8 rounded-lg items-center justify-center">
                <Ionicons name={icon} size={16} color="#ef4444" />
            </View>
            <View className="ml-4 flex-1">
                <Text style={{ color: THEME.text }} className="text-[11px] font-black uppercase italic">{title}</Text>
                <Text style={{ color: THEME.textSecondary }} className="text-[10px] leading-4">{desc}</Text>
            </View>
        </View>
    );
}

function BadgeItem({ icon, title, sub, color }) {
  return (
    <View style={{ backgroundColor: THEME.card, borderColor: THEME.border }} className="w-36 p-5 rounded-[24px] border-2 mr-4 items-center shadow-xl">
      <View style={{ backgroundColor: `${color}15`, borderColor: `${color}40` }} className="w-12 h-12 rounded-2xl items-center justify-center mb-3 border">
        <MaterialCommunityIcons name={icon} size={24} color={color} />
      </View>
      <Text style={{ color: THEME.text }} className="text-[10px] font-black uppercase text-center italic">{title}</Text>
      <View style={{ backgroundColor: color }} className="h-[2px] w-4 my-2 opacity-50" />
      <Text style={{ color: THEME.textSecondary }} className="text-[8px] font-bold uppercase text-center tracking-tighter">{sub}</Text>
    </View>
  );
}

function ScouterNode({ label, val, color, glow = false }) {
    return (
        <View className="items-center">
            <Text style={{ color }} className={`text-[9px] font-black uppercase ${glow ? 'text-red-500' : ''}`}>{label}</Text>
            <Text style={{ color: THEME.text }} className="text-[10px] font-black italic">{val}</Text>
            {glow && <View style={{ backgroundColor: '#ef4444', height: 2, width: '100%', marginTop: 2, shadowColor: '#ef4444', shadowRadius: 5, shadowOpacity: 1 }} />}
        </View>
    );
}