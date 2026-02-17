import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import {
  Clipboard,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Share,
  TouchableOpacity,
  View
} from "react-native";
import { Text } from "../../components/Text";
import THEME from "../../components/useAppTheme";
import { useUser } from "../../context/UserContext";
import apiFetch from "../../utils/apiFetch";

const CACHE_KEY = "referral_dashboard_cache";

export default function ReferralDashboard() {
    const { user } = useUser();
    const [copied, setCopied] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    
    // UI State initialized with empty or Context fallbacks
    const [dbData, setDbData] = useState({
        referralCode: user?.referralCode || "---",
        invitedUsers: []
    });

    // 1. Load from AsyncStorage on Mount (The Cache)
    useEffect(() => {
        const loadCache = async () => {
            try {
                const cached = await AsyncStorage.getItem(CACHE_KEY);
                if (cached) {
                    setDbData(JSON.parse(cached));
                }
            } catch (e) {
                console.error("Cache load failed", e);
            }
        };
        loadCache();
        fetchLatestData(); // Background fetch immediately after
    }, []);

    const referralLink = `https://play.google.com/store/apps/details?id=com.kaytee.oreblogda&referrer=${dbData.referralCode}`;

    // 2. Fetch from DB & Save to Cache
    const fetchLatestData = async () => {
        try {
            if (user?.deviceId) {
                const response = await apiFetch(`https://oreblogda.com/api/users/me?fingerprint=${user.deviceId}`);
                if (response) {
                    const newData = {
                        referralCode: response.referralCode || user.referralCode,
                        invitedUsers: response.invitedUsers || []
                    };
                    setDbData(newData);
                    // Update Cache
                    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newData));
                }
            }
        } catch (error) {
            console.error("Sync failed:", error);
        } finally {
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchLatestData();
    }, [user?.deviceId]);

    const copyToClipboard = () => {
        Clipboard.setString(dbData.referralCode);
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
            className="flex-1 p-5 rounded-[24px] border-2 m-1 relative overflow-hidden"
        >
            <View className="absolute -right-3 -top-3 opacity-10">
                 <MaterialCommunityIcons name={icon} size={70} color={color} />
            </View>
            <View style={{ backgroundColor: `${color}20` }} className="w-10 h-10 rounded-xl items-center justify-center mb-3">
                <MaterialCommunityIcons name={icon} size={22} color={color} />
            </View>
            <Text className="text-[14px] font-black uppercase italic" style={{ color: THEME.text }}>{title}</Text>
            <Text className="text-[8px] font-bold uppercase tracking-[0.1em] opacity-60" style={{ color: THEME.textSecondary }}>{sub}</Text>
            <View style={{ backgroundColor: color }} className="h-[2px] w-8 mt-3 rounded-full" />
        </View>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
            <ScrollView 
                showsVerticalScrollIndicator={false} 
                className="px-6"
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.accent} />
                }
            >
                
                {/* Visual Header - Anime/Spirit Theme */}
                <View className="mt-10 mb-8 flex-row justify-between items-end">
                    <View>
                        <View className="flex-row items-center mb-1">
                            <View style={{ backgroundColor: THEME.accent }} className="w-1 h-3 mr-2" />
                            <Text style={{ color: THEME.accent }} className="text-[10px] font-black uppercase tracking-[0.4em]">Spirit Covenant</Text>
                        </View>
                        <Text style={{ color: THEME.text }} className="text-4xl font-black italic uppercase tracking-tighter">Aura</Text>
                        <Text style={{ color: THEME.text }} className="text-4xl font-black italic uppercase tracking-tighter -mt-2 opacity-40">Resonance</Text>
                    </View>
                    <MaterialCommunityIcons name="auto-fix" size={40} color={THEME.accent} style={{ opacity: 0.2, marginBottom: 5 }} />
                </View>

                {/* Summoning Sigil Card */}
                <View style={{ backgroundColor: THEME.card, borderColor: THEME.border }} className="w-full p-8 rounded-[35px] border-2 shadow-2xl mb-8 relative">
                    <View style={{ backgroundColor: THEME.bg, borderColor: THEME.border }} className="absolute -top-3 left-8 px-4 py-1 rounded-full border-2 flex-row items-center">
                        <View style={{ backgroundColor: THEME.accent }} className="w-1.5 h-1.5 rounded-full mr-2" />
                        <Text style={{ color: THEME.text }} className="text-[8px] font-black uppercase tracking-widest">Sigil Active</Text>
                    </View>

                    <Text style={{ color: THEME.textSecondary }} className="text-[9px] font-black uppercase tracking-[0.3em] mb-4 opacity-50 text-center">Your Summoning Signature</Text>
                    
                    <View style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderColor: THEME.border }} className="flex-row items-center justify-between p-6 rounded-[24px] border-2 border-dashed mb-6">
                        <Text style={{ color: THEME.text }} className="text-3xl font-black italic tracking-[0.2em]">{dbData.referralCode}</Text>
                        <TouchableOpacity 
                            onPress={copyToClipboard} 
                            style={{ backgroundColor: `${THEME.accent}20`, borderColor: THEME.accent }}
                            className="p-3 rounded-2xl border"
                        >
                            <Ionicons name={copied ? "checkmark-sharp" : "copy-outline"} size={22} color={THEME.accent} />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity 
                        onPress={onShare}
                        activeOpacity={0.9}
                        style={{ backgroundColor: THEME.accent, shadowColor: THEME.accent, shadowOffset: { width: 0, height: 10 }, shadowRadius: 20, shadowOpacity: 0.3 }}
                        className="w-full py-5 rounded-[22px] flex-row justify-center items-center"
                    >
                        <MaterialCommunityIcons name="star-shooting" size={20} color="white" />
                        <Text className="text-white font-black uppercase italic ml-3 tracking-[0.15em] text-[15px]">Gather Disciples</Text>
                    </TouchableOpacity>
                </View>

                {/* Blessing Protocol Section */}
                <View className="flex-row items-center justify-between mb-4 px-1">
                    <View className="flex-row items-center">
                        <View style={{ backgroundColor: '#eab308' }} className="w-1.5 h-1.5 rounded-sm rotate-45 mr-3" />
                        <Text style={{ color: THEME.textSecondary }} className="text-[10px] font-black uppercase tracking-[0.2em]">Karmic Rewards</Text>
                    </View>
                    <Text style={{ color: THEME.textSecondary }} className="text-[8px] font-bold opacity-30">V.3.1.2</Text>
                </View>

                <View className="flex-row mb-10">
                    {/* Fixed Icon for Aura: Star-Four-Points aligns much better with spirit/aura energy */}
                    <RewardCard icon="star-four-points" title="+20 Aura" sub="Soul Perk" color="#eab308" />
                    <RewardCard icon="fire" title="2X Boost" sub="72hr Overdrive" color="#ef4444" />
                </View>

                {/* Disciples List */}
                <View className="mb-24">
                    <View className="flex-row justify-between items-center mb-6 px-1 border-b-2 border-dashed" style={{ borderColor: THEME.border, paddingBottom: 12 }}>
                        <Text style={{ color: THEME.text }} className="text-[14px] font-black uppercase italic tracking-tight">Awakened Disciples</Text>
                        <View style={{ backgroundColor: `${THEME.accent}20` }} className="px-4 py-1 rounded-full border">
                            <Text style={{ color: THEME.accent }} className="text-[11px] font-black">{dbData.invitedUsers.length}</Text>
                        </View>
                    </View>

                    {dbData.invitedUsers.length > 0 ? (
                        dbData.invitedUsers.map((item, index) => (
                            <View 
                                key={index} 
                                style={{ backgroundColor: THEME.card, borderColor: THEME.border }} 
                                className="w-full p-4 rounded-[22px] border-2 mb-3 flex-row items-center justify-between"
                            >
                                <View className="flex-row items-center">
                                    <View style={{ backgroundColor: THEME.bg, borderColor: THEME.border }} className="w-12 h-12 rounded-2xl items-center justify-center mr-4 border-2">
                                        <MaterialCommunityIcons name="account-heart-outline" size={24} color={THEME.accent} />
                                    </View>
                                    <View>
                                        <Text style={{ color: THEME.text }} className="font-black italic uppercase text-[14px]">{item.username}</Text>
                                        <Text style={{ color: THEME.textSecondary }} className="text-[9px] uppercase font-bold opacity-60 tracking-tighter">
                                            Joined Realm: {new Date(item.date).toLocaleDateString()}
                                        </Text>
                                    </View>
                                </View>
                                <View style={{ backgroundColor: '#22c55e15', borderColor: '#22c55e40' }} className="px-3 py-1 rounded-lg border">
                                    <Text className="text-[#22c55e] text-[8px] font-black uppercase">Blessed</Text>
                                </View>
                            </View>
                        ))
                    ) : (
                        <View 
                            style={{ backgroundColor: THEME.card, borderColor: THEME.border }} 
                            className="py-16 items-center rounded-[35px] border-2 border-dashed opacity-50"
                        >
                            <MaterialCommunityIcons name="meditation" size={40} color={THEME.textSecondary} className="mb-2" />
                            <Text style={{ color: THEME.textSecondary }} className="text-[10px] font-black uppercase tracking-[0.3em]">No Spirits Linked Yet</Text>
                        </View>
                    )}
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}