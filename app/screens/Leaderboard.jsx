import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LegendList } from "@legendapp/list";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    DeviceEventEmitter,
    Dimensions,
    TouchableOpacity,
    View,
    useColorScheme
} from "react-native";
import { useMMKV } from 'react-native-mmkv';
import Animated, {
    FadeInRight,
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from "react-native-reanimated";
import useSWR from 'swr';
import PeakBadge from '../../components/PeakBadge';
import PlayerNameplate from '../../components/PlayerNameplate';
import { SyncLoading } from '../../components/SyncLoading';
import { Text } from "../../components/Text";
import TitleTag from '../../components/TitleTag';
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
    // 🎨 Global Constants
    const MONARCH_GOLD = '#fbbf24';
    const JADE_GREEN = '#10b981';    // 🐉 Yonko (Consistent Jade)
    const SHADOW_PURPLE = '#a855f7';
    const STEEL_BLUE = '#3b82f6';

    // ⚔️ Progressive Espada Gradient (Brightest -> Darkest)
    const ESPADA_0 = '#f43f5e'; // Bright Rose (Rank 5)
    const ESPADA_1 = '#e11d48'; // Vibrant Ruby
    const ESPADA_2 = '#be123c'; // Royal Crimson
    const ESPADA_3 = '#9f1239'; // Deep Crimson
    const ESPADA_4 = '#881337'; // Dark Wine
    const ESPADA_5 = '#4c0519'; // Black Cherry (Rank 10)

    // DEFAULT FALLBACK OBJECT
    const fallback = { color: '#64748b', label: 'PLAYER', icon: 'shield-check' };

    if (!rank || rank > 10 || rank <= 0) return fallback; // Return object, not undefined;

    switch (rank) {
        case 1:
            return { color: MONARCH_GOLD, label: 'MONARCH', icon: 'crown' };
        case 2:
            return { color: JADE_GREEN, label: 'YONKO', icon: 'flare' };
        case 3:
            return { color: SHADOW_PURPLE, label: 'KAGE', icon: 'moon-waxing-crescent' };
        case 4:
            return { color: STEEL_BLUE, label: 'SHOGUN', icon: 'shield-star' };

        // --- ESPADA RANKS (Progressive & Unique) ---
        case 5:
            return { color: ESPADA_0, label: 'ESPADA 0', icon: 'skull' };
        case 6:
            return { color: ESPADA_1, label: 'ESPADA 1', icon: 'sword-cross' };
        case 7:
            return { color: ESPADA_2, label: 'ESPADA 2', icon: 'sword-cross' };
        case 8:
            return { color: ESPADA_3, label: 'ESPADA 3', icon: 'sword-cross' };
        case 9:
            return { color: ESPADA_4, label: 'ESPADA 4', icon: 'sword-cross' };
        case 10:
            return { color: ESPADA_5, label: 'ESPADA 5', icon: 'sword-cross' };

        default:
            return { color: '#1e293b', label: 'VANGUARD', icon: 'shield-check' };
    }
};

const resolveClanTier = (rank) => {
    if (rank === 1) return CLAN_TIERS[1];
    if (rank <= 3) return CLAN_TIERS[2];
    if (rank <= 10) return CLAN_TIERS[3];
    if (rank <= 25) return CLAN_TIERS[4];
    if (rank <= 50) return CLAN_TIERS[5];
    return CLAN_TIERS[6];
};

const formatCoins = (num) => {
    if (!num) return "0";
    if (num >= 1000000) return Math.floor(num / 1000000) + 'M+';
    if (num >= 1000) return Math.floor(num / 1000) + 'k+';
    return num.toString();
};

export const AURA_TIERS = [
    { level: 1, req: 0, title: "E-Rank Novice", icon: "🌱", color: "#94a3b8" },
    { level: 2, req: 100, title: "D-Rank Operative", icon: "⚔️", color: "#34d399" },
    { level: 3, req: 300, title: "C-Rank Awakened", icon: "🔥", color: "#f87171" },
    { level: 4, req: 700, title: "B-Rank Elite", icon: "⚡", color: "#a78bfa" },
    { level: 5, req: 1500, title: "A-Rank Champion", icon: "🛡️", color: "#60a5fa" },
    { level: 6, req: 3000, title: "S-Rank Legend", icon: "🌟", color: "#fcd34d" },
    { level: 7, req: 6000, title: "SS-Rank Mythic", icon: "🌀", color: "#f472b6" },
    { level: 8, req: 12000, title: "Monarch", icon: "👑", color: "#fbbf24" },
];

const resolveUserRank = (level, currentAura) => {
    const safeLevel = Math.max(1, Math.min(8, level || 1));
    const currentTier = AURA_TIERS[safeLevel - 1];
    const nextTier = AURA_TIERS[safeLevel] || currentTier;

    let progress = 100;
    if (safeLevel < 8) {
        progress = ((currentAura - currentTier.req) / (nextTier.req - currentTier.req)) * 100;
    }

    return {
        title: currentTier.title.toUpperCase().replace(/ /g, "_"),
        icon: currentTier.icon,
        color: currentTier.color,
        progress: Math.min(Math.max(progress, 0), 100)
    };
};

export default function Leaderboard() {
    const storage = useMMKV();
    const router = useRouter();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const [category, setCategory] = useState("authors");
    const [type, setType] = useState("level");
    const [cachedData, setCachedData] = useState(null);
    const [isOfflineMode, setIsOfflineMode] = useState(false);

    const CACHE_KEY = `LB_CACHE_${category.toUpperCase()}_${type.toUpperCase()}`;

    useEffect(() => {
        if (category === "clans") {
            setType("points");
        } else {
            setType("level");
        }
    }, [category]);

    useEffect(() => {
        try {
            const local = storage.getString(CACHE_KEY);
            if (local) setCachedData(JSON.parse(local));
        } catch (e) { console.error(e); }
    }, [type, category, storage, CACHE_KEY]);

    const { data: swrData, isLoading } = useSWR(
        `/leaderboard?category=${category}&type=${type}&limit=200`,
        fetcher,
        {
            dedupingInterval: 1000 * 60,
            revalidateOnFocus: true,
            onSuccess: (newData) => {
                setIsOfflineMode(false);
                storage.set(CACHE_KEY, JSON.stringify(newData));
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

    const authorTabs = ["level", "aura", "posts", "streak", "peak"];
    const clanTabs = ["points", "followers", "weekly", "badges"];
    const currentTabs = category === "authors" ? authorTabs : clanTabs;
    const TAB_WIDTH = (TOGGLE_WIDTH - 8) / currentTabs.length;

    useEffect(() => {
        let index = currentTabs.indexOf(type);
        if (index === -1) index = 0;
        tabOffset.value = withSpring(index * TAB_WIDTH, { damping: 20, stiffness: 90 });
    }, [type, category, currentTabs, TAB_WIDTH, tabOffset]);

    const animatedSliderStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: tabOffset.value }],
        backgroundColor: category === "authors"
            ? (type === "level" ? (isDark ? '#1e293b' : '#3b82f6')
                : type === "aura" ? '#ec4899'  // Pink for Weekly Glory
                    : type === "posts" ? '#8b5cf6' // Purple for Posts
                        : type === "streak" ? '#f59e0b' // Orange for Streak
                            : '#10b981') // Emerald for Peak
            : (isDark ? '#1e293b' : '#3b82f6'),
        borderColor: category === "authors"
            ? (type === "level" ? '#60a5fa'
                : type === "aura" ? '#f472b6'
                    : type === "posts" ? '#a78bfa'
                        : type === "streak" ? '#fbbf24'
                            : '#34d399')
            : '#60a5fa',
        width: TAB_WIDTH
    }));

    const statusColor = isOfflineMode ? "#f59e0b" : "#60a5fa";

    const renderItem = ({ item, index }) => {
        if (!item) return null;
        const isTop3 = index < 3;
        const highlightColor =
            index === 0 ? "#fbbf24" :
                index === 1 ? "#94a3b8" :
                    index === 2 ? "#cd7f32" :
                        "transparent";

        if (category === "authors") {
            const postCount = item.postCount || 0;
            const streakCount = item.streak || 0;
            const peakLvl = item.peakLevel || 0;
            const purchasedCoins = item.totalPurchasedCoins || 0;
            const equippedTitle = item.equippedTitle || null;
            const totalAura = item.aura || 0;
            const rankLevel = item.currentRankLevel || 1;

            const writerRank = resolveUserRank(rankLevel, totalAura);
            const weeklyAuraRank = getAuraTier(item.previousRank);

            return (
                <View
                    style={{
                        backgroundColor: isTop3 ? (isDark ? 'rgba(30, 41, 59, 0.4)' : '#f0f9ff') : 'transparent',
                        borderBottomWidth: 1,
                        borderBottomColor: isDark ? '#1e293b' : '#e2e8f0',
                        paddingVertical: 14,
                        paddingHorizontal: 8,
                        borderRadius: isTop3 ? 16 : 0,
                        marginBottom: isTop3 ? 8 : 0,
                        borderLeftWidth: isTop3 ? 4 : (weeklyAuraRank ? 2 : 0),
                        borderLeftColor: isTop3 ? highlightColor : (weeklyAuraRank ? weeklyAuraRank.color : 'transparent'),
                    }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 20, alignItems: 'center' }}>
                            <Text style={{ fontSize: isTop3 ? 14 : 10, fontWeight: '900', color: isTop3 ? highlightColor : (isDark ? '#475569' : '#94a3b8') }}>
                                {String(index + 1).padStart(2, '0')}
                            </Text>
                        </View>

                        <View style={{ width: 24, alignItems: 'center', marginRight: 6 }}>
                            {peakLvl > 0 ? (
                                <PeakBadge level={peakLvl} size={18} />
                            ) : (
                                <MaterialCommunityIcons name="lock" size={14} color={isDark ? "#334155" : "#cbd5e1"} />
                            )}
                        </View>

                        <TouchableOpacity style={{ flex: 1 }} onPress={() => DeviceEventEmitter.emit("navigateSafely", { pathname: "/author/[userId]", params: { userId: item.userId } })}>

                            <PlayerNameplate
                                author={item}
                                themeColor={weeklyAuraRank ? weeklyAuraRank.color : (isDark ? '#fff' : '#000')}
                                equippedGlow={item.equippedGlow}
                                auraRank={item.previousRank || 999}
                                isDark={isDark}
                                fontSize={13}
                                showFlame={false}
                                showPeakBadge={false}
                            />

                            {weeklyAuraRank && (
                                // <View style={{ backgroundColor: weeklyAuraRank.color, paddingHorizontal: 4, borderRadius: 4, alignSelf: 'flex-start', marginTop: 2 }}>
                                //     <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#000' }}>{weeklyAuraRank.label}</Text>
                                // </View>
                                <View className="">
                                    <TitleTag rank={item.previousRank} key={equippedTitle} size={7} equippedTitle={equippedTitle} auraVisuals={weeklyAuraRank} isTop10={item.previousRank <= 10} />
                                </View>
                            )}
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                <Text style={{ fontSize: 9, fontWeight: 'bold', color: writerRank.color, letterSpacing: 1 }}>
                                    {writerRank.icon} {writerRank.title}
                                </Text>
                            </View>
                            <View style={{ height: 3, width: '80%', backgroundColor: isDark ? '#0f172a' : '#e2e8f0', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
                                <Animated.View entering={FadeInRight.delay(300).duration(800)} style={{ height: '100%', width: `${writerRank.progress}%`, backgroundColor: writerRank.color }} />
                            </View>
                        </TouchableOpacity>

                        {/* ⚡️ REORDERED TO MATCH TABS: AURA -> GLRY -> DOCS -> STRK -> PEAK */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, width: 100, justifyContent: 'flex-end' }}>
                            <View style={{ alignItems: 'center', width: 20 }}>
                                <Text style={{ fontSize: 6, color: '#3b82f6', fontWeight: 'bold' }}>AURA</Text>
                                <Text style={{ fontSize: 11, fontWeight: '900', color: '#3b82f6' }}>{formatCoins(totalAura)}</Text>
                            </View>
                            <View style={{ alignItems: 'center', width: 20 }}>
                                <Text style={{ fontSize: 6, color: '#ec4899', fontWeight: 'bold' }}>GLRY</Text>
                                <Text style={{ fontSize: 11, fontWeight: '900', color: '#ec4899' }}>{formatCoins(item.weeklyAura || 0)}</Text>
                            </View>
                            <View style={{ alignItems: 'center', width: 20 }}>
                                <Text style={{ fontSize: 6, color: '#8b5cf6', fontWeight: 'bold' }}>DOCS</Text>
                                <Text style={{ fontSize: 11, fontWeight: '900', color: isDark ? '#fff' : '#000' }}>{formatCoins(postCount)}</Text>
                            </View>
                            <View style={{ alignItems: 'center', width: 20 }}>
                                <Text style={{ fontSize: 6, color: '#f59e0b', fontWeight: 'bold' }}>STRK</Text>
                                <Text style={{ fontSize: 11, fontWeight: '900', color: '#f59e0b' }}>{streakCount}</Text>
                            </View>
                            <View style={{ alignItems: 'center', width: 20 }}>
                                <Text style={{ fontSize: 6, color: '#10b981', fontWeight: 'bold' }}>PEAK</Text>
                                <Text style={{ fontSize: 11, fontWeight: '900', color: '#10b981' }}>{formatCoins(purchasedCoins)}</Text>
                            </View>
                        </View>
                    </View>
                </View>
            );
        } else {
            const clanTier = resolveClanTier(item.rank || index + 1);
            return (
                <View
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
                            <PlayerNameplate
                                author={item}
                                themeColor={clanTier.color}
                                equippedGlow={item.equippedGlow}
                                auraRank={999}
                                isDark={isDark}
                                fontSize={15}
                                showFlame={false}
                                showPeakBadge={false}
                            />
                            <View style={{ backgroundColor: '#111', paddingHorizontal: 4, borderRadius: 4, alignSelf: 'flex-start', marginTop: 2, borderWidth: 1, borderColor: clanTier.color }}>
                                <Text style={{ fontSize: 7, fontWeight: 'bold', color: clanTier.color }}>{item.tag}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                                <Text style={{ fontSize: 9, fontWeight: 'bold', color: clanTier.color, letterSpacing: 1 }}>
                                    {clanTier.label} // {clanTier.title}
                                </Text>
                            </View>
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: 140, justifyContent: 'flex-end' }}>
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
                </View>
            );
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: isDark ? "#000" : "#fff", paddingHorizontal: 16, paddingTop: 60 }}>
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
                                {category === "authors" ? "PLAYER_INTEL" : "CLAN_HIERARCHY"}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>

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
                            {cat === "authors" ? "PLAYERS" : "CLANS"}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={{
                backgroundColor: isDark ? '#0a0a0a' : '#f1f5f9',
                borderRadius: 18, padding: 4, marginBottom: 15,
                borderWidth: 1, borderColor: isDark ? '#1e293b' : '#e2e8f0',
                height: 56, justifyContent: 'center'
            }}>
                <Animated.View style={[animatedSliderStyle, { position: 'absolute', height: 46, borderRadius: 14, left: 4, borderWidth: 1 }]} />

                <View style={{ flexDirection: 'row', height: '100%', zIndex: 20 }}>
                    {currentTabs.map((tab) => (
                        <TouchableOpacity
                            key={tab}
                            activeOpacity={1}
                            onPress={() => setType(tab)}
                            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                        >
                            {/* ⚡️ RENDER LOGIC: If type="aura", display "GLORY" */}
                            <Text style={{ fontWeight: '900', fontSize: 10, color: type === tab ? '#fff' : '#64748b' }}>
                                {tab === "aura" ? "GLORY" : tab.toUpperCase()}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: isDark ? '#1e293b' : '#e2e8f0' }}>
                <Text style={{ width: 30, fontSize: 10, fontWeight: 'bold', color: '#475569' }}>POS</Text>
                <Text style={{ flex: 1, fontSize: 10, fontWeight: 'bold', color: '#475569', paddingLeft: 42 }}>{category === "authors" ? "PLAYER_NAME" : "CLAN_NAME"}</Text>
                <Text style={{ width: 140, fontSize: 10, fontWeight: 'bold', color: '#475569', textAlign: 'center' }}>PERFORMANCE</Text>
            </View>

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
                <View style={{ flex: 1 }}>
                    <LegendList
                        data={leaderboardData}
                        keyExtractor={(item, idx) => (item.userId || item.clanId || idx).toString()}
                        renderItem={renderItem}
                        removeClippedSubviews={true}
                        estimatedItemSize={80}
                        drawDistance={1000}
                        recycleItems={true}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 40 }}
                    />
                </View>
            )}
        </View>
    );
}