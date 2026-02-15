import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Clipboard, SafeAreaView, ScrollView, Share, TouchableOpacity, View } from "react-native";
import { Text } from "../../components/Text";
import THEME from "../../components/useAppTheme";
import { useUser } from "../../context/UserContext";

export default function ReferralDashboard() {
  const { user } = useUser();
  const [copied, setCopied] = useState(false);

  // Fallback data if user hasn't invited anyone yet
  const invitedUsers = user?.invitedUsers || [];
  const referralCode = user?.referralCode || "PENDING";
  
  const referralLink = `https://play.google.com/store/apps/details?id=com.kaytee.oreblogda&referrer=${referralCode}`;

  const copyToClipboard = () => {
    Clipboard.setString(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const onShare = async () => {
    try {
      await Share.share({
        message: `Join me on Oreblogda! Use my link to get +20 Aura and 3 days of Double Streak boosts: ${referralLink}`,
      });
    } catch (error) {
      console.log(error.message);
    }
  };

  const RewardCard = ({ icon, title, sub, color }) => (
    <View 
      style={{ backgroundColor: THEME.card, borderColor: THEME.border }} 
      className="flex-1 p-5 rounded-[28px] border-2 m-1 shadow-lg relative overflow-hidden"
    >
      <View className="absolute -right-2 -top-2 opacity-5">
         <MaterialCommunityIcons name={icon} size={60} color={color} />
      </View>
      <MaterialCommunityIcons name={icon} size={28} color={color} />
      <Text className="text-[13px] font-black uppercase italic mt-3" style={{ color: THEME.text }}>{title}</Text>
      <View style={{ backgroundColor: color, height: 2, width: 12, marginVertical: 4 }} />
      <Text className="text-[9px] font-bold uppercase tracking-tighter" style={{ color: THEME.textSecondary }}>{sub}</Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} className="px-6">
        
        {/* Header Section */}
        <View className="mt-10 mb-8">
          <Text style={{ color: THEME.accent }} className="text-[10px] font-black uppercase tracking-[0.5em] mb-1">Recruitment Division</Text>
          <Text style={{ color: THEME.text }} className="text-4xl font-black italic uppercase tracking-tighter">Network Uplink</Text>
          <View className="h-1 w-12 bg-pink-500 mt-2" />
        </View>

        {/* Tactical Referral Card */}
        <View style={{ backgroundColor: THEME.card, borderColor: THEME.border }} className="w-full p-8 rounded-[40px] border-2 shadow-2xl mb-8 relative">
          <View className="absolute top-0 right-10 bg-pink-500 px-3 py-1 rounded-b-xl">
             <Text className="text-white text-[8px] font-black uppercase">Active Frequency</Text>
          </View>

          <Text style={{ color: THEME.textSecondary }} className="text-[10px] font-black uppercase tracking-[0.2em] mb-4">Personal Enlistment Code</Text>
          
          <View className="flex-row items-center justify-between bg-black/40 p-5 rounded-2xl border border-white/5 mb-6">
            <Text style={{ color: THEME.text }} className="text-2xl font-black italic tracking-widest">{referralCode}</Text>
            <TouchableOpacity 
                onPress={copyToClipboard} 
                className="bg-white/5 p-3 rounded-xl border border-white/10"
            >
                <Ionicons name={copied ? "checkmark-circle" : "copy"} size={22} color={copied ? "#22c55e" : THEME.accent} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            onPress={onShare}
            activeOpacity={0.8}
            style={{ backgroundColor: THEME.accent, shadowColor: THEME.accent, shadowRadius: 15, shadowOpacity: 0.4 }}
            className="w-full py-5 rounded-2xl flex-row justify-center items-center"
          >
            <MaterialCommunityIcons name="broadcast" size={20} color="white" />
            <Text className="text-white font-black uppercase italic ml-3 tracking-[0.2em] text-[14px]">Broadcast Signal</Text>
          </TouchableOpacity>
        </View>

        {/* Bounty / Reward Protocol */}
        <View className="flex-row items-center mb-4 ml-1">
            <View className="w-2 h-2 bg-yellow-500 rounded-full mr-2" />
            <Text style={{ color: THEME.textSecondary }} className="text-[10px] font-black uppercase tracking-widest">Successful Intel Reward</Text>
        </View>
        <View className="flex-row mb-10">
          {/* Aura Reward: star-four-points represents energy/aura spark */}
          <RewardCard icon="star-four-points" title="+20 Aura" sub="Spirit Bonus" color="#eab308" />
          <RewardCard icon="fire" title="2X STREAK" sub="72H Overdrive" color="#ef4444" />
        </View>

        {/* Operatives List */}
        <View className="mb-20">
          <View className="flex-row justify-between items-center mb-6 px-1 border-b border-white/5 pb-2">
            <Text style={{ color: THEME.text }} className="text-[12px] font-black uppercase italic">Acquired Operatives</Text>
            <View className="bg-white/10 px-3 py-1 rounded-full border border-white/10">
                <Text style={{ color: THEME.accent }} className="text-[10px] font-black">{invitedUsers.length}</Text>
            </View>
          </View>

          {invitedUsers.length > 0 ? (
            invitedUsers.map((item, index) => (
              <View 
                key={index} 
                style={{ backgroundColor: THEME.card, borderColor: THEME.border }} 
                className="w-full p-5 rounded-[24px] border-2 mb-3 flex-row items-center justify-between"
              >
                <View className="flex-row items-center">
                  <View style={{ backgroundColor: `${THEME.accent}20`, borderColor: THEME.accent }} className="w-10 h-10 rounded-xl items-center justify-center mr-4 border">
                    <Text style={{ color: THEME.accent }} className="font-black text-lg">{item.username?.charAt(0).toUpperCase() || "O"}</Text>
                  </View>
                  <View>
                    <Text style={{ color: THEME.text }} className="font-black italic uppercase text-[13px] tracking-tight">{item.username}</Text>
                    <View className="flex-row items-center mt-1">
                        <Ionicons name="time-outline" size={10} color={THEME.textSecondary} />
                        <Text style={{ color: THEME.textSecondary }} className="text-[9px] uppercase ml-1 font-bold">{new Date(item.date).toLocaleDateString()}</Text>
                    </View>
                  </View>
                </View>
                <View className="bg-green-500/10 p-2 rounded-lg border border-green-500/20">
                    <MaterialCommunityIcons name="shield-check" size={18} color="#22c55e" />
                </View>
              </View>
            ))
          ) : (
            <View style={{ backgroundColor: THEME.card, borderColor: THEME.border }} className="py-12 items-center rounded-[32px] border-2 border-dashed opacity-40">
              <MaterialCommunityIcons name="account-search-outline" size={48} color={THEME.textSecondary} />
              <Text style={{ color: THEME.textSecondary }} className="text-[10px] font-black uppercase mt-3 tracking-widest">No Operatives Located</Text>
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}