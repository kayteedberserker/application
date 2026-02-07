import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    DeviceEventEmitter,
    Dimensions,
    FlatList,
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
import { SyncLoading } from '../../components/SyncLoading';
import { Text } from "../../components/Text";
import apiFetch from "../../utils/apiFetch";

const { width } = Dimensions.get('window');
const API_URL = "https://oreblogda.com";

const fetcher = (url) => apiFetch(url).then((res) => res.json());

const CLAN_TIERS = {
    6: { label: 'VI', color: '#ef4444', title: "The Akatsuki" },        
    5: { label: 'V', color: '#e0f2fe', title: "The Espada" },          
    4: { label: 'IV', color: '#a855f7', title: "Phantom Troupe" },        
    3: { label: 'III', color: '#60a5fa', title: "Upper Moon" },          
    2: { label: 'II', color: '#10b981', title: "Squad 13" },   
    1: { label: 'I', color: '#94a3b8', title: "Wandering Ronin" },           
};

const getAuraTier = (rank) => {
    if (!rank || rank > 10 || rank <= 0) return null;
    switch (rank) {
        case 1: return { color: '#fbbf24', label: 'MONARCH' };
        case 2: return { color: '#ef4444', label: 'YONKO' };
        case 3: return { color: '#a855f7', label: 'KAGE' };
        case 4: return { color: '#3b82f6', label: 'SHOGUN' };
        case 5: return { color: '#e0f2fe', label: 'ESPADA 0' }; 
        case 6: return { color: '#cbd5e1', label: 'ESPADA 1' };
        case 7: return { color: '#94a3b8', label: 'ESPADA 2' };
        case 8: return { color: '#64748b', label: 'ESPADA 3' };
        case 9: return { color: '#475569', label: 'ESPADA 4' };
        case 10: return { color: '#334155', label: 'ESPADA 5' };
        default: return { color: '#1e293b', label: 'OPERATIVE' };
    }
};

// Helper to determine Clan Tier UI based on numerical rank from API
const resolveClanTier = (rank) => {
    if (rank === 1) return CLAN_TIERS[1];
    if (rank <= 3) return CLAN_TIERS[2];
    if (rank <= 10) return CLAN_TIERS[3];
    if (rank <= 25) return CLAN_TIERS[4];
    if (rank <= 50) return CLAN_TIERS[5];
    return CLAN_TIERS[6];
};

export default function Leaderboard() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    
    const [category, setCategory] = useState("authors"); // "authors" | "clans"
    const [type, setType] = useState("posts");
    const [cachedData, setCachedData] = useState(null);
    const [isOfflineMode, setIsOfflineMode] = useState(false);

    const CACHE_KEY = `LB_CACHE_${category.toUpperCase()}_${type.toUpperCase()}`;

    useEffect(() => {
        if (category === "clans") {
            setType("points");
        } else {
            setType("posts");
        }
    }, [category]);

    useEffect(() => {
        const loadCache = async () => {
            try {
                const local = await AsyncStorage.getItem(CACHE_KEY);
                if (local) setCachedData(JSON.parse(local));
            } catch (e) { console.error(e); }
        };
        loadCache();
    }, [type, category]);

    const { data: swrData, error, isLoading } = useSWR(
        `/leaderboard?category=${category}&type=${type}&limit=50`,
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
    
    const authorTabs = ["posts", "streak", "aura"];
    const clanTabs = ["points", "followers", "weekly", "badges"];
    const currentTabs = category === "authors" ? authorTabs : clanTabs;
    const TAB_WIDTH = (TOGGLE_WIDTH - 8) / currentTabs.length;

    useEffect(() => {
        let index = currentTabs.indexOf(type);
        if (index === -1) index = 0;
        tabOffset.value = withSpring(index * TAB_WIDTH, { damping: 20, stiffness: 90 });
    }, [type, category]);

    const animatedSliderStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: tabOffset.value }],
        backgroundColor: category === "authors" 
            ? (type === "posts" ? (isDark ? '#1e293b' : '#3b82f6') : type === "streak" ? '#f59e0b' : '#8b5cf6')
            : (isDark ? '#1e293b' : '#3b82f6'),
        borderColor: category === "authors"
            ? (type === "posts" ? '#60a5fa' : type === "streak" ? '#fbbf24' : '#a78bfa')
            : '#60a5fa',
        width: TAB_WIDTH
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
        if (!item) return null; // Safety check
        const isTop3 = index < 3;
        const highlightColor =
            index === 0 ? "#fbbf24" :
            index === 1 ? "#94a3b8" :
            index === 2 ? "#cd7f32" :
            "transparent";

        if (category === "authors") {
            const postCount = item.postCount || 0;
            const streakCount = item.streak || 0;
            const auraPoints = item.weeklyAura || 0;
            const writerRank = resolveUserRank(postCount);
            const aura = getAuraTier(item.previousRank); 
            const progress = Math.min((postCount / writerRank.next) * 100, 100);

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
                            <Text style={{ fontSize: isTop3 ? 18 : 14, fontWeight: '900', color: isTop3 ? highlightColor : (isDark ? '#475569' : '#94a3b8') }}>
                                {String(index + 1).padStart(2, '0')}
                            </Text>
                        </View>
                        <TouchableOpacity style={{ flex: 1, paddingLeft: 10 }} onPress={() => DeviceEventEmitter.emit("navigateSafely", { pathname: "/author/[userId]", params: { userId: item.userId } })}>
                            <Text style={{ fontSize: 15, fontWeight: '800', color: aura ? aura.color : (isDark ? '#fff' : '#000'), letterSpacing: 0.5 }}>
                                {(item.username || "GUEST").toUpperCase()}
                            </Text>
                            {aura && (
                                <View style={{ backgroundColor: aura.color, paddingHorizontal: 4, borderRadius: 4, alignSelf: 'flex-start', marginTop: 2 }}>
                                    <Text style={{ fontSize: 7, fontWeight: 'bold', color: '#000' }}>{aura.label}</Text>
                                </View>
                            )}
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                                <Text style={{ fontSize: 9, fontWeight: 'bold', color: writerRank.color, letterSpacing: 1 }}>
                                    {writerRank.icon} {writerRank.title}
                                </Text>
                            </View>
                            <View style={{ height: 3, width: '80%', backgroundColor: isDark ? '#0f172a' : '#e2e8f0', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
                                <Animated.View entering={FadeInRight.delay(300).duration(800)} style={{ height: '100%', width: `${progress}%`, backgroundColor: writerRank.color }} />
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
                            <View style={{ alignItems: 'center', width: 35 }}>
                                <Text style={{ fontSize: 7, color: '#a78bfa', fontWeight: 'bold' }}>AURA</Text>
                                <Text style={{ fontSize: 13, fontWeight: '900', color: '#a78bfa' }}>{auraPoints}</Text>
                            </View>
                        </View>
                    </View>
                </Animated.View>
            );
        } else {
            // CLAN RENDER LOGIC
            const clanTier = resolveClanTier(item.rank || index + 1);
            
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
                        borderLeftWidth: isTop3 ? 4 : 2,
                        borderLeftColor: isTop3 ? highlightColor : clanTier.color,
                    }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 35, alignItems: 'center' }}>
                            <Text style={{ fontSize: isTop3 ? 18 : 14, fontWeight: '900', color: isTop3 ? highlightColor : (isDark ? '#475569' : '#94a3b8') }}>
                                {String(index + 1).padStart(2, '0')}
                            </Text>
                        </View>
                        <TouchableOpacity style={{ flex: 1, paddingLeft: 10 }} onPress={() => DeviceEventEmitter.emit("navigateSafely", { pathname: "/clans/[tag]", params: { tag: item.tag } })}>
                            <Text style={{ fontSize: 15, fontWeight: '800', color: clanTier.color, letterSpacing: 0.5 }}>
                                {(item.name || "UNNAMED").toUpperCase()}
                            </Text>
                            <View style={{ backgroundColor: '#111', paddingHorizontal: 4, borderRadius: 4, alignSelf: 'flex-start', marginTop: 2, borderWidth: 1, borderColor: clanTier.color }}>
                                <Text style={{ fontSize: 7, fontWeight: 'bold', color: clanTier.color }}>{item.tag}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                                <Text style={{ fontSize: 9, fontWeight: 'bold', color: clanTier.color, letterSpacing: 1 }}>
                                    {clanTier.label} // {clanTier.title}
                                </Text>
                            </View>
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ alignItems: 'center', width: 30 }}>
                                <Text style={{ fontSize: 6, color: '#64748b', fontWeight: 'bold' }}>PTS</Text>
                                <Text style={{ fontSize: 11, fontWeight: '900', color: isDark ? '#fff' : '#000' }}>{item.totalPoints || 0}</Text>
                            </View>
                            <View style={{ alignItems: 'center', width: 30 }}>
                                <Text style={{ fontSize: 6, color: '#60a5fa', fontWeight: 'bold' }}>FOL</Text>
                                <Text style={{ fontSize: 11, fontWeight: '900', color: '#60a5fa' }}>{item.followerCount || 0}</Text>
                            </View>
                            <View style={{ alignItems: 'center', width: 30 }}>
                                <Text style={{ fontSize: 6, color: '#f59e0b', fontWeight: 'bold' }}>WEEK</Text>
                                <Text style={{ fontSize: 11, fontWeight: '900', color: '#f59e0b' }}>{item.currentWeeklyPoints || 0}</Text>
                            </View>
                            <View style={{ alignItems: 'center', width: 30 }}>
                                <Text style={{ fontSize: 6, color: '#ef4444', fontWeight: 'bold' }}>BDG</Text>
                                <Text style={{ fontSize: 11, fontWeight: '900', color: '#ef4444' }}>{item.badgeCount || 0}</Text>
                            </View>
                        </View>
                    </View>
                </Animated.View>
            );
        }
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
                                {category === "authors" ? "OPERATIVE_INTEL" : "CLAN_HIERARCHY"} // {isOfflineMode ? "ARCHIVED" : "LIVE"}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Category Switcher */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 15 }}>
                {["authors", "clans"].map((cat) => (
                    <TouchableOpacity 
                        key={cat}
                        onPress={() => setCategory(cat)}
                        style={{ 
                            flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                            backgroundColor: category === cat ? (isDark ? '#1e293b' : '#3b82f6') : (isDark ? '#0a0a0a' : '#f1f5f9'),
                            borderWidth: 1, borderColor: category === cat ? '#60a5fa' : (isDark ? '#1e293b' : '#e2e8f0')
                        }}
                    >
                        <Text style={{ fontSize: 10, fontWeight: '900', color: category === cat ? '#fff' : '#64748b' }}>
                            {cat === "authors" ? "OPERATIVES" : "CLANS"}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Dynamic Toggle Switch */}
            <View style={{ 
                backgroundColor: isDark ? '#0a0a0a' : '#f1f5f9', 
                borderRadius: 18, padding: 4, marginBottom: 15,
                borderWidth: 1, borderColor: isDark ? '#1e293b' : '#e2e8f0',
                height: 56, justifyContent: 'center'
            }}>
                <Animated.View style={[ animatedSliderStyle, { position: 'absolute', height: 46, borderRadius: 14, left: 4, borderWidth: 1 } ]} />

                <View style={{ flexDirection: 'row', height: '100%', zIndex: 20 }}>
                    {currentTabs.map((tab) => (
                        <TouchableOpacity 
                            key={tab}
                            activeOpacity={1}
                            onPress={() => setType(tab)} 
                            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Text style={{ fontWeight: '900', fontSize: 10, color: type === tab ? '#fff' : '#64748b' }}>{tab.toUpperCase()}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* List Header */}
            <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: isDark ? '#1e293b' : '#e2e8f0' }}>
                <Text style={{ width: 35, fontSize: 10, fontWeight: 'bold', color: '#475569' }}>POS</Text>
                <Text style={{ flex: 1, fontSize: 10, fontWeight: 'bold', color: '#475569', paddingLeft: 10 }}>{category === "authors" ? "OPERATIVE_NAME" : "CLAN_NAME"}</Text>
                <Text style={{ width: category === "clans" ? 140 : 110, fontSize: 10, fontWeight: 'bold', color: '#475569', textAlign: 'center' }}>PERFORMANCE</Text>
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
                    keyExtractor={(item, idx) => (item.userId || item.clanId || idx).toString()}
                    renderItem={renderItem}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 40 }}
                />
            )}
        </View>
    );
}