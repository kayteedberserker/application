import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme as useNativeWind } from "nativewind";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Clipboard,
    RefreshControl,
    ScrollView,
    Share,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../components/Text";
import THEME from "../../components/useAppTheme";
import { useUser } from "../../context/UserContext";
import apiFetch from "../../utils/apiFetch";

const CACHE_KEY = "referral_event_cache_v4";

export default function ReferralScreen() {
    const { colorScheme } = useNativeWind();
    const isDark = colorScheme === "dark";
    const { user } = useUser();
    const [copied, setCopied] = useState(false);

    const [loading, setLoading] = useState(false); 
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState({
        round: 1,
        roundTotal: 0,
        leaderboard: [],
        currentMilestone: { goal: 500, reward: "$10", winners: 1 },
        progress: 0
    });
    
    const referralCode = user?.referralCode?.toUpperCase() || "RECRUIT_01";
    const referralLink = `https://oreblogda.com/register?ref=${referralCode}`;

    const rounds = [
        { id: 1, title: "Initiate Rank", reward: "$10", color: "#cd7f32", icon: "fountain-pen-tip" },
        { id: 2, title: "Elite Vanguard", reward: "$50", color: "#94a3b8", icon: "sword-cross" },
        { id: 3, title: "Legendary Sannin", reward: "$100", color: "#fbbf24", icon: "crown" },
    ];

    const fetchReferralData = async (isBackground = false) => {
        // Show loading if it's the first time or not a background refresh
        if (!isBackground && data.leaderboard.length === 0) setLoading(true);
        
        try {
            const response = await apiFetch("/referrals/stats", {
                method: "GET"
            });
            
            // Since apiFetch returns the raw fetch response, we MUST parse it
            const result = await response.json();
            
            if (response.ok && result.success) {
                const updatedData = {
                    round: result.round,
                    roundTotal: result.roundTotal,
                    leaderboard: result.leaderboard || [],
                    currentMilestone: result.currentMilestone,
                    progress: result.progress
                };
                setData(updatedData);
                await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(updatedData));
            }
        } catch (error) {
            console.error("Failed to fetch event data:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const cached = await AsyncStorage.getItem(CACHE_KEY);
                if (cached) {
                    setData(JSON.parse(cached));
                }
                fetchReferralData(true);
            } catch (e) {
                fetchReferralData();
            }
        };
        loadInitialData();
    }, []);

    const copyToClipboard = () => {
        Clipboard.setString(referralCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const onShare = async () => {
        try {
            await Share.share({
                message: `Join my Clan on OreBlog! 🌀 Help us unlock the ${rounds[data.round - 1]?.reward} Grand Reward: ${referralLink}`,
            });
        } catch (error) {
            console.log(error.message);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchReferralData(true);
    }, []);

    // 🔹 LOADING STATE
    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={THEME.accent} />
                <Text style={{ color: THEME.textSecondary, marginTop: 15 }} className="font-black uppercase text-[10px] tracking-[0.2em]">
                    Gathering Chakra...
                </Text>
            </SafeAreaView>
        );
    }

    const QuestRow = ({ roundItem }) => {
        const isActive = data.round === roundItem.id;
        const isLocked = roundItem.id > data.round;
        const isCompleted = roundItem.id < data.round;
        const progressClamped = Math.min(data.progress || 0, 100);

        return (
            <View 
                style={{ 
                    borderColor: isActive ? roundItem.color : THEME.border, 
                    backgroundColor: isActive ? `${roundItem.color}10` : THEME.card 
                }}
                className={`flex-row items-center justify-between p-5 rounded-[25px] border-2 mb-4 relative overflow-hidden`}
            >
                {isLocked && <View className="absolute inset-0 bg-black/60 z-10 items-center justify-center rounded-2xl" />}
                
                <View className="flex-row items-center flex-1">
                    <View 
                        style={{ backgroundColor: `${roundItem.color}20`, borderColor: `${roundItem.color}40` }}
                        className="w-12 h-12 rounded-2xl items-center justify-center border mr-4"
                    >
                        <MaterialCommunityIcons 
                            name={roundItem.icon} 
                            size={24} 
                            color={roundItem.color} 
                        />
                    </View>

                    <View className="flex-1">
                        <View className="flex-row items-center">
                            <Text style={{ color: roundItem.color }} className="text-[10px] font-black uppercase tracking-widest">{roundItem.title}</Text>
                            {isActive && <View className="w-1.5 h-1.5 bg-green-500 rounded-full ml-2" />}
                        </View>
                        <Text style={{ color: THEME.text }} className="text-[16px] font-black uppercase mb-1">REWARD: {roundItem.reward}</Text>
                        
                        {isActive && (
                            <View className="mt-3 mr-4 relative">
                                <View 
                                    style={{ left: `${progressClamped}%`, marginLeft: -10 }} 
                                    className="absolute -top-5 items-center"
                                >
                                    <View style={{ backgroundColor: roundItem.color }} className="px-1.5 py-0.5 rounded-md shadow-sm">
                                        <MaterialCommunityIcons name="star-four-points" size={10} color="white" />
                                    </View>
                                </View>

                                <View className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden">
                                    <View 
                                        style={{ width: `${progressClamped}%`, backgroundColor: roundItem.color }} 
                                        className="h-full" 
                                    />
                                </View>
                                <View className="flex-row justify-between mt-1">
                                    <Text className="text-[8px] font-bold text-slate-500 uppercase">
                                        {data.roundTotal} SUMMONED
                                    </Text>
                                    <Text style={{ color: roundItem.color }} className="text-[8px] font-black uppercase">
                                        GOAL: {roundItem.goal || (roundItem.id === 1 ? 500 : roundItem.id === 2 ? 1000 : 3000)}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>
                </View>

                <View className="items-center justify-center ml-2">
                    {isCompleted ? (
                        <View className="bg-green-500/20 p-2 rounded-full border border-green-500/40">
                             <Ionicons name="checkmark-done" size={20} color="#10b981" />
                        </View>
                    ) : (
                        <MaterialCommunityIcons 
                            name={isLocked ? "lock" : "chevron-right"} 
                            size={24} 
                            color={isActive ? roundItem.color : THEME.textSecondary} 
                        />
                    )}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
            <ScrollView 
                showsVerticalScrollIndicator={false} 
                className="px-6"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.accent} />}
            >
                {/* Header */}
                <View className="mt-8 mb-6 flex-row justify-between items-center">
                    <View>
                        <View className="flex-row items-center mb-1">
                             <View style={{ backgroundColor: THEME.accent }} className="w-2 h-2 rounded-sm rotate-45 mr-2" />
                             <Text style={{ color: THEME.accent }} className="text-[10px] font-black uppercase tracking-[0.3em]">Special Event</Text>
                        </View>
                        <Text style={{ color: THEME.text }} className="text-3xl font-black uppercase tracking-tighter italic">Grand Summoning</Text>
                    </View>
                    <View className="bg-white/5 p-3 rounded-2xl border border-white/10">
                        <MaterialCommunityIcons name="weather-night" size={24} color={THEME.accent} />
                    </View>
                </View>

                {/* Referral Code Card */}
                <View style={{ backgroundColor: THEME.card, borderColor: THEME.border }} className="p-6 rounded-[35px] border-2 mb-8 shadow-sm">
                    <View className="flex-row items-center mb-4">
                        <MaterialCommunityIcons name="seal" size={14} color="#ef4444" className="mr-2" />
                        <Text style={{ color: THEME.textSecondary }} className="text-[9px] font-bold uppercase tracking-widest">Your Spirit Sigil</Text>
                    </View>
                    
                    <View className="flex-row items-center justify-between bg-black/20 p-4 rounded-2xl border border-white/5 mb-5">
                        <View>
                            <Text style={{ color: THEME.textSecondary }} className="text-[8px] font-bold uppercase mb-1">SIGIL CODE</Text>
                            <Text style={{ color: THEME.text }} className="text-xl font-black tracking-widest italic">{referralCode}</Text>
                        </View>
                        <TouchableOpacity 
                            onPress={copyToClipboard} 
                            className={`p-3 rounded-xl border ${copied ? 'bg-green-500/20 border-green-500' : 'bg-white/5 border-white/10'}`}
                        >
                            <Ionicons name={copied ? "checkmark-circle" : "copy-outline"} size={20} color={copied ? "#22c55e" : THEME.accent} />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity 
                        onPress={onShare}
                        activeOpacity={0.8}
                        style={{ backgroundColor: THEME.accent }}
                        className="py-4 rounded-2xl flex-row justify-center items-center shadow-lg"
                    >
                        <MaterialCommunityIcons name="auto-fix" size={18} color="white" />
                        <Text className="text-white font-black uppercase ml-2 tracking-widest text-[13px] italic">Summon Disciples</Text>
                    </TouchableOpacity>
                </View>

                {/* Progression Section */}
                <View className="flex-row items-center mb-5 ml-1">
                    <MaterialCommunityIcons name="medal-outline" size={16} color={THEME.accent} />
                    <Text className="text-gray-500 font-black uppercase text-[11px] tracking-widest ml-2">Clan Progression</Text>
                </View>
                
                <View className="mb-8">
                    {rounds.map((round) => (
                        <QuestRow key={round.id} roundItem={round} />
                    ))}
                </View>

                {/* Leaderboard */}
                <View className="mb-20">
                    <View className="flex-row justify-between items-center mb-6 px-1">
                        <Text style={{ color: THEME.text }} className="text-xl font-black uppercase italic">Top Recruiter</Text>
                        <View style={{ backgroundColor: `${THEME.accent}20`, borderColor: THEME.accent }} className="px-3 py-1 rounded-full border">
                             <Text style={{ color: THEME.accent }} className="text-[9px] font-bold uppercase">Real-Time</Text>
                        </View>
                    </View>

                    {data.leaderboard.length > 0 ? (
                        data.leaderboard.map((item, index) => (
                            <View 
                                key={index} 
                                style={{ backgroundColor: THEME.card, borderColor: THEME.border }} 
                                className="w-full p-4 rounded-[22px] border-2 mb-3 flex-row items-center justify-between"
                            >
                                <View className="flex-row items-center">
                                    <View className={`w-8 h-8 rounded-lg items-center justify-center mr-4 border ${index === 0 ? 'bg-yellow-500/20 border-yellow-500' : 'bg-black/20 border-white/10'}`}>
                                        <Text style={{ color: index === 0 ? '#eab308' : THEME.text }} className="font-black text-xs">{index + 1}</Text>
                                    </View>
                                    <View>
                                        <Text style={{ color: THEME.text }} className="font-bold uppercase text-[13px] italic">{item.username}</Text>
                                        <Text style={{ color: THEME.textSecondary }} className="text-[8px] uppercase">AUTHOR</Text>
                                    </View>
                                </View>
                                <View className="items-end">
                                    <Text style={{ color: THEME.accent }} className="font-black text-sm">{item.count}</Text>
                                    <Text className="text-slate-500 text-[7px] font-bold uppercase">RECRUITS</Text>
                                </View>
                            </View>
                        ))
                    ) : (
                        <View className="py-12 items-center opacity-40">
                            <MaterialCommunityIcons name="ghost-off" size={40} color={THEME.textSecondary} />
                            <Text style={{ color: THEME.textSecondary }} className="text-[10px] font-bold uppercase mt-3 italic">Searching for Awakened Souls...</Text>
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}