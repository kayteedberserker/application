import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    Dimensions,
    TouchableOpacity,
    View,
    useColorScheme,
    FlatList
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SyncLoading } from '../../components/SyncLoading';
import { Text } from "../../components/Text";

const { width } = Dimensions.get('window');
const API_URL = "https://oreblogda.com";

const fetcher = (url) => fetch(url).then((res) => res.json());

// ----------------------
// ✨ AURA UTILITY HELPER
// ----------------------
const getAuraTier = (rank) => {
    if (!rank || rank > 10) return null;
    switch (rank) {
        case 1: return { color: '#fbbf24', label: 'PROTAGONIST' };
        case 2: return { color: '#60a5fa', label: 'RIVAL' };
        case 3: return { color: '#cd7f32', label: 'SENSEI' };
        case 4: return { color: '#a78bfa', label: 'ELITE' };
        case 5: return { color: '#f87171', label: 'SPECIAL' };
        default: return { color: '#34d399', label: 'VANGUARD' };
    }
};

export default function Leaderboard() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    
    const [type, setType] = useState("posts");
    const [cachedData, setCachedData] = useState(null);
    const [isOfflineMode, setIsOfflineMode] = useState(false);

    const CACHE_KEY = `LEADERBOARD_CACHE_${type.toUpperCase()}`;

    useEffect(() => {
        const loadCache = async () => {
            try {
                const local = await AsyncStorage.getItem(CACHE_KEY);
                if (local) setCachedData(JSON.parse(local));
            } catch (e) { console.error(e); }
        };
        loadCache();
    }, [type]);

    const { data: swrData, error, isLoading } = useSWR(
        `${API_URL}/api/leaderboard?type=${type}&limit=50`,
        fetcher,
        {
            dedupingInterval: 1000 * 60,
            revalidateOnFocus: true,
            onSuccess: (newData) => {
                setIsOfflineMode(false);
                AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newData));
            },
            onError: () => {
                setIsOfflineMode(true);
            }
        }
    );

    const leaderboardData = useMemo(() => {
        return swrData?.leaderboard || cachedData?.leaderboard || [];
    }, [swrData, cachedData]);

    const tabOffset = useSharedValue(0);
    const TOGGLE_WIDTH = width - 32;
    const TAB_WIDTH = (TOGGLE_WIDTH - 8) / 3;

    useEffect(() => {
        let target = 0;
        if (type === "streak") target = TAB_WIDTH;
        if (type === "aura") target = TAB_WIDTH * 2;
        tabOffset.value = withSpring(target, { damping: 20, stiffness: 90 });
    }, [type]);

    const animatedSliderStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: tabOffset.value }],
        backgroundColor: type === "posts" ? (isDark ? '#1e293b' : '#3b82f6') : type === "streak" ? '#f59e0b' : '#8b5cf6',
        borderColor: type === "posts" ? '#60a5fa' : type === "streak" ? '#fbbf24' : '#a78bfa',
    }));

    const statusColor = isOfflineMode ? "#f59e0b" : "#60a5fa";

    const resolveUserRank = (totalPosts) => {
        const count = totalPosts || 0;
        if (count >= 200) return { title: "MASTER_WRITER", icon: "👑", color: "#fbbf24", next: 500 };
        if (count > 150) return { title: "ELITE_WRITER", icon: "💎", color: "#60a5fa", next: 200 };
        if (count > 100) return { title: "SENIOR_WRITER", icon: "🔥", color: "#f87171", next: 150 };
        if (count > 50) return { title: "NOVICE_WRITER", icon: "⚔️", color: "#a78bfa", next: 100 };
        if (count > 25) return { title: "RESEACHER_SR", icon: "📜", color: "#34d399", next: 50 };
        return { title: "RESEACHER_JR", icon: "🛡️", color: "#94a3b8", next: 25 };
    };

    const renderItem = ({ item, index }) => {
        const postCount = item.postCount || 0;
        const streakCount = item.streak || 0;
        const auraPoints = item.weeklyAura || 0;
        
        const writerRank = resolveUserRank(postCount);
        const aura = getAuraTier(item.previousRank); 
        const isTop3 = index < 3;
        const progress = Math.min((postCount / writerRank.next) * 100, 100);

        const highlightColor =
            index === 0 ? "#fbbf24" :
            index === 1 ? "#94a3b8" :
            index === 2 ? "#cd7f32" :
            "transparent";

        return (
            <Animated.View
                entering={FadeInDown.delay(index * 20).springify()}
                layout={LinearTransition}
                style={{
                    backgroundColor: isTop3 ? (isDark ? 'rgba(30, 41, 59, 0.4)' : '#f0f9ff') : 'transparent',
                    borderBottomWidth: 1,
                    borderBottomColor: isDark ? '#1e293b' : '#e2e8f0',
                    paddingVertical: 18,
                    paddingHorizontal: 12,
                    borderRadius: isTop3 ? 16 : 0,
                    marginBottom: isTop3 ? 8 : 0,
                    borderLeftWidth: isTop3 ? 4 : (aura ? 2 : 0),
                    borderLeftColor: isTop3 ? highlightColor : (aura ? aura.color : 'transparent'),
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
                        onPress={() => router.push({ pathname: "/author/[userId]", params: { userId: item.userId } })}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ 
                                fontSize: 15, 
                                fontWeight: '800', 
                                color: aura ? aura.color : (isDark ? '#fff' : '#000'), 
                                letterSpacing: 0.5 
                            }}>
                                {(item.username || "GUEST").toUpperCase()}
                            </Text>
                            {aura && (
                                <View style={{ marginLeft: 6, backgroundColor: aura.color, paddingHorizontal: 4, borderRadius: 4 }}>
                                    <Text style={{ fontSize: 7, fontWeight: 'bold', color: '#000' }}>{aura.label}</Text>
                                </View>
                            )}
                        </View>
                        
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                            <Text style={{ fontSize: 9, fontWeight: 'bold', color: writerRank.color, letterSpacing: 1 }}>
                                {writerRank.icon} {writerRank.title}
                            </Text>
                        </View>

                        <View style={{ height: 3, width: '80%', backgroundColor: isDark ? '#0f172a' : '#e2e8f0', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
                            <Animated.View
                                entering={FadeInRight.delay(300).duration(800)}
                                style={{ height: '100%', width: `${progress}%`, backgroundColor: writerRank.color }}
                            />
                        </View>
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ alignItems: 'center', width: 32 }}>
                            <Text style={{ fontSize: 7, color: '#64748b', fontWeight: 'bold' }}>DOCS</Text>
                            <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#fff' : '#000' }}>{postCount}</Text>
                        </View>

                        <View style={{ alignItems: 'center', width: 32 }}>
                            <Ionicons name="flame" size={10} color="#f59e0b" />
                            <Text style={{ fontSize: 13, fontWeight: '900', color: '#f59e0b' }}>{streakCount}</Text>
                        </View>

                        {/* Aura Section - Completely Clean (No Background) */}
                        <View style={{ alignItems: 'center', width: 35 }}>
                            <Text style={{ fontSize: 7, color: '#a78bfa', fontWeight: 'bold' }}>AURA</Text>
                            <Text style={{ fontSize: 13, fontWeight: '900', color: '#a78bfa' }}>{auraPoints}</Text>
                        </View>
                    </View>
                </View>
            </Animated.View>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: isDark ? "#000" : "#fff", paddingHorizontal: 16, paddingTop: 60 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 25 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={{ padding: 10, borderRadius: 12, backgroundColor: isDark ? '#111' : '#f8fafc', borderWidth: 1, borderColor: isDark ? '#222' : '#eee' }}
                    >
                        <Ionicons name="chevron-back" size={20} color={statusColor} />
                    </TouchableOpacity>
                    <View style={{ marginLeft: 15 }}>
                        <Text style={{ fontSize: 22, fontVariant: ['small-caps'], fontWeight: '900', color: isDark ? '#fff' : '#000' }}>COMMAND_CENTER</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ width: 6, height: 6, borderRadius: 4, backgroundColor: statusColor, marginRight: 6 }} />
                            <Text style={{ fontSize: 8, color: statusColor, fontWeight: 'bold', letterSpacing: 1.5 }}>
                                {isOfflineMode ? "OFFLINE_MODE // ARCHIVED" : "LIVE_OPERATIONS // GLOBAL"}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Three-Way Toggle Switch - Bug Fix: Higher Z-Index on buttons */}
            <View style={{ 
                backgroundColor: isDark ? '#0a0a0a' : '#f1f5f9', 
                borderRadius: 18, 
                padding: 4, 
                marginBottom: 15,
                borderWidth: 1,
                borderColor: isDark ? '#1e293b' : '#e2e8f0',
                height: 56,
                justifyContent: 'center'
            }}>
                <Animated.View style={[
                    animatedSliderStyle,
                    {
                        position: 'absolute',
                        width: TAB_WIDTH,
                        height: 46,
                        borderRadius: 14,
                        left: 4,
                        borderWidth: 1,
                    }
                ]} />

                <View style={{ flexDirection: 'row', height: '100%', zIndex: 20 }}>
                    <TouchableOpacity 
                        activeOpacity={1}
                        onPress={() => setType("posts")} 
                        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Text style={{ fontWeight: '900', fontSize: 10, color: type === "posts" ? '#fff' : '#64748b' }}>POSTS</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        activeOpacity={1}
                        onPress={() => setType("streak")} 
                        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Text style={{ fontWeight: '900', fontSize: 10, color: type === "streak" ? '#fff' : '#64748b' }}>STREAK</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        activeOpacity={1}
                        onPress={() => setType("aura")} 
                        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Text style={{ fontWeight: '900', fontSize: 10, color: type === "aura" ? '#fff' : '#64748b' }}>AURA</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* List Header */}
            <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: isDark ? '#1e293b' : '#e2e8f0' }}>
                <Text style={{ width: 35, fontSize: 10, fontWeight: 'bold', color: '#475569' }}>POS</Text>
                <Text style={{ flex: 1, fontSize: 10, fontWeight: 'bold', color: '#475569', paddingLeft: 10 }}>OPERATIVE_NAME</Text>
                <Text style={{ width: 110, fontSize: 10, fontWeight: 'bold', color: '#475569', textAlign: 'center' }}>PERFORMANCE</Text>
            </View>

            {/* Content */}
            {(isLoading && leaderboardData.length === 0) ? (
                <View style={{ flex: 1, justifyContent: 'center' }}>
                    <SyncLoading message='Scanning Neural Core' />
                </View>
            ) : leaderboardData.length === 0 ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name="cloud-off-outline" size={40} color="#64748b" />
                    <Text style={{ color: '#64748b', fontWeight: '900', marginTop: 10, letterSpacing: 1 }}>NO DATA AVAILABLE</Text>
                </View>
            ) : (
                <FlatList
                    data={leaderboardData}
                    keyExtractor={(item) => (item.userId || Math.random()).toString()}
                    renderItem={renderItem}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 40 }}
                />
            )}
        </View>
    );
}
