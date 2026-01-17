import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    Dimensions,
    TouchableOpacity,
    View,
    useColorScheme
} from "react-native";
import Animated, {
    FadeInDown,
    FadeInRight,
    LinearTransition,
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from "react-native-reanimated";
import useSWR from 'swr';
import AsyncStorage from "@react-native-async-storage/async-storage"; // 👈 Added
import { SyncLoading } from '../../components/SyncLoading';
import { Text } from "../../components/Text";

const { width } = Dimensions.get('window');
const API_URL = "https://oreblogda.com";

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function Leaderboard() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const [type, setType] = useState("posts");
    
    // 👈 New State for Offline Logic
    const [cachedData, setCachedData] = useState(null);
    const [isOfflineMode, setIsOfflineMode] = useState(false);

    // Dynamic Cache Key based on tab (Posts vs Streak)
    const CACHE_KEY = `LEADERBOARD_CACHE_${type.toUpperCase()}`;

    // 1. Load Cache when tab changes
    useEffect(() => {
        const loadCache = async () => {
            try {
                const local = await AsyncStorage.getItem(CACHE_KEY);
                if (local) setCachedData(JSON.parse(local));
            } catch (e) { console.error(e); }
        };
        loadCache();
    }, [type]); // Re-run when switching tabs

    // 2. SWR Hook with Offline Handling
    const { data: swrData, error, isLoading } = useSWR(
        `${API_URL}/api/leaderboard?type=${type}&limit=200`,
        fetcher,
        {
            dedupingInterval: 1000 * 60 * 5, // 5 minutes in-memory cache
            revalidateOnFocus: false,
            fallbackData: cachedData, // 👈 Instant load
            onSuccess: (newData) => {
                setIsOfflineMode(false); // We are online
                AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newData)); // Save to phone
            },
            onError: () => {
                setIsOfflineMode(true); // Fetch failed, switch UI to offline
            }
        }
    );

    // Prioritize SWR data, fall back to Cache, then empty array
    const leaderboardData = useMemo(() => {
        return swrData?.leaderboard || cachedData?.leaderboard || [];
    }, [swrData, cachedData]);

    // Animation for the sliding toggle
    const tabOffset = useSharedValue(0);
    const TOGGLE_WIDTH = width - 32;
    const TAB_WIDTH = (TOGGLE_WIDTH - 8) / 2;

    useEffect(() => {
        tabOffset.value = withSpring(type === "posts" ? 0 : TAB_WIDTH, { damping: 15 });
    }, [type]);

    const animatedSliderStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: tabOffset.value }],
        backgroundColor: type === "posts" ? '#1e293b' : '#2d1b0d',
        borderColor: type === "posts" ? '#60a5fa' : '#f59e0b',
    }));

    // Status Colors (Blue/Green for Online, Orange for Offline)
    const statusColor = isOfflineMode ? "#f59e0b" : "#60a5fa";

    const resolveUserRank = (totalPosts) => {
        const count = totalPosts;
        if (count >= 200) return { title: "MASTER_WRITER", icon: "👑", color: "#fbbf24", next: 500 };
        if (count > 150) return { title: "ELITE_WRITER", icon: "💎", color: "#60a5fa", next: 200 };
        if (count > 100) return { title: "SENIOR_WRITER", icon: "🔥", color: "#f87171", next: 150 };
        if (count > 50) return { title: "NOVICE_WRITER", icon: "⚔️", color: "#a78bfa", next: 100 };
        if (count > 25) return { title: "RESEACHER_SR", icon: "📜", color: "#34d399", next: 50 };
        return { title: "RESEACHER_JR", icon: "🛡️", color: "#94a3b8", next: 25 };
    };

    const renderItem = ({ item, index }) => {
        const rank = resolveUserRank(item.postCount);
        const isTop3 = index < 3;
        const progress = Math.min((item.postCount / rank.next) * 100, 100);

        const highlightColor =
            index === 0 ? "#fbbf24" :
            index === 1 ? "#94a3b8" :
            index === 2 ? "#cd7f32" :
            "transparent";

        return (
            <Animated.View
                entering={FadeInDown.delay(index * 30).springify()} // Reduced delay for snappier feel
                layout={LinearTransition}
                style={{
                    backgroundColor: isTop3 ? (isDark ? 'rgba(30, 41, 59, 0.4)' : '#f0f9ff') : 'transparent',
                    borderBottomWidth: 1,
                    borderBottomColor: isDark ? '#1e293b' : '#e2e8f0',
                    paddingVertical: 18,
                    paddingHorizontal: 12,
                    borderRadius: isTop3 ? 16 : 0,
                    marginBottom: isTop3 ? 8 : 0,
                    borderLeftWidth: isTop3 ? 4 : 0,
                    borderLeftColor: highlightColor,
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 35, alignItems: 'center' }}>
                        <Text style={{ 
                            fontSize: isTop3 ? 18 : 14, 
                            fontWeight: '900', 
                            color: isTop3 ? highlightColor : (isDark ? '#475569' : '#94a3b8') 
                        }}>
                            {String(index + 1).padStart(2, '0')}
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={{ flex: 1, paddingLeft: 10 }}
                        onPress={() => router.push({ pathname: "/author/[userId]", params: { userId: item.adminId || item.userId } })}
                    >
                        <Text style={{ fontSize: 16, fontWeight: '800', color: isDark ? '#fff' : '#000', letterSpacing: 0.5 }}>
                            {item.username.toUpperCase()}
                        </Text>
                        
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                            <Text style={{ fontSize: 10, fontWeight: 'bold', color: rank.color, letterSpacing: 1 }}>
                                {rank.icon} {rank.title}
                            </Text>
                        </View>

                        <View style={{ height: 4, width: '85%', backgroundColor: isDark ? '#0f172a' : '#e2e8f0', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
                            <Animated.View
                                entering={FadeInRight.delay(500).duration(1000)}
                                style={{ height: '100%', width: `${progress}%`, backgroundColor: rank.color }}
                            />
                        </View>
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                        <View style={{ alignItems: 'center', width: 45 }}>
                            <Text style={{ fontSize: 10, color: '#64748b', fontWeight: 'bold', marginBottom: 2 }}>DOCS</Text>
                            <Text style={{ fontSize: 18, fontWeight: '900', color: isDark ? '#fff' : '#000' }}>
                                {item.postCount}
                            </Text>
                        </View>
                        <View style={{ alignItems: 'center', width: 45 }}>
                            <Ionicons name="flame" size={14} color="#f59e0b" style={{ marginBottom: 2 }} />
                            <Text style={{ fontSize: 18, fontWeight: '900', color: '#f59e0b' }}>
                                {item.streak}
                            </Text>
                        </View>
                    </View>
                </View>
            </Animated.View>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: isDark ? "#000" : "#fff", paddingHorizontal: 16, paddingTop: 60 }}>
            {/* Header with Offline Indication */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 25 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={{ padding: 10, borderRadius: 12, backgroundColor: isDark ? '#111' : '#f8fafc', borderWidth: 1, borderColor: isDark ? '#222' : '#eee' }}
                    >
                        <Ionicons name="chevron-back" size={20} color={statusColor} />
                    </TouchableOpacity>
                    <View style={{ marginLeft: 15 }}>
                        <Text style={{ fontSize: 24, fontWeight: '900', color: isDark ? '#fff' : '#000' }}>COMMAND_CENTER</Text>
                        
                        <View className="flex-row items-center gap-2">
                             {/* Status Dot */}
                            <View style={{ width: 6, height: 6, borderRadius: 4, backgroundColor: statusColor }} />
                            <Text style={{ fontSize: 9, color: statusColor, fontWeight: 'bold', letterSpacing: 2 }}>
                                {isOfflineMode ? "OFFLINE_MODE // ARCHIVED_RANK" : "LIVE_OPERATIONS // GLOBAL_RANK"}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Toggle Switch */}
            <View style={{ 
                backgroundColor: isDark ? '#0a0a0a' : '#f1f5f9', 
                borderRadius: 16, 
                padding: 4, 
                marginBottom: 10,
                borderWidth: 1,
                borderColor: isDark ? '#1e293b' : '#e2e8f0',
                position: 'relative',
                height: 52,
                justifyContent: 'center'
            }}>
                <Animated.View style={[
                    animatedSliderStyle,
                    {
                        position: 'absolute',
                        width: TAB_WIDTH,
                        height: 42,
                        borderRadius: 12,
                        left: 4,
                        borderWidth: 1,
                        shadowColor: type === "posts" ? '#60a5fa' : '#f59e0b',
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.3,
                        shadowRadius: 10,
                    }
                ]} />

                <View style={{ flexDirection: 'row', zIndex: 1 }}>
                    <TouchableOpacity
                        onPress={() => setType("posts")}
                        style={{ flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                    >
                        <Ionicons name="document-text" size={12} color={type === "posts" ? "#60a5fa" : "#64748b"} />
                        <Text style={{ 
                            fontWeight: '900', 
                            fontSize: 10, 
                            color: type === "posts" ? '#fff' : '#64748b',
                            letterSpacing: 1
                        }}>SORT_BY_POSTS</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                        onPress={() => setType("streak")}
                        style={{ flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                    >
                        <Ionicons name="flame" size={12} color={type === "streak" ? "#f59e0b" : "#64748b"} />
                        <Text style={{ 
                            fontWeight: '900', 
                            fontSize: 10, 
                            color: type === "streak" ? '#fff' : '#64748b',
                            letterSpacing: 1
                        }}>SORT_BY_STREAK</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={{ 
                flexDirection: 'row', 
                paddingHorizontal: 12, 
                paddingVertical: 12, 
                borderBottomWidth: 1,
                borderBottomColor: isDark ? '#1e293b' : '#e2e8f0'
            }}>
                <Text style={{ width: 35, fontSize: 10, fontWeight: 'bold', color: '#475569' }}>POS</Text>
                <Text style={{ flex: 1, fontSize: 10, fontWeight: 'bold', color: '#475569', paddingLeft: 10 }}>OPERATIVE_NAME</Text>
                <Text style={{ width: 105, fontSize: 10, fontWeight: 'bold', color: '#475569', textAlign: 'center' }}>PERFORMANCE</Text>
            </View>

            {/* Content Logic */}
            {(isLoading && leaderboardData.length === 0) ? (
                <View className="mt-[50%]">
                    <SyncLoading message='Scanning Core' />
                </View>
            ) : leaderboardData.length === 0 ? (
                 // Empty State (Cache empty + Offline)
                <View style={{ alignItems: 'center', marginTop: 100 }}>
                    <MaterialCommunityIcons name="cloud-off-outline" size={40} color="#64748b" />
                    <Text style={{ color: '#64748b', fontWeight: '900', marginTop: 10, letterSpacing: 1 }}>NO DATA AVAILABLE</Text>
                </View>
            ) : (
                <Animated.FlatList
                    data={leaderboardData}
                    keyExtractor={(item) => item.userId.toString()}
                    renderItem={renderItem}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    itemLayoutAnimation={LinearTransition}
                />
            )}
        </View>
    );
}
