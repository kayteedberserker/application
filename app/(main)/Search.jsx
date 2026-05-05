import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LegendList } from "@legendapp/list";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    DeviceEventEmitter,
    Image,
    ScrollView,
    StatusBar,
    TextInput,
    TouchableOpacity,
    useColorScheme,
    View
} from "react-native";
import { useMMKV } from "react-native-mmkv";
import Animated, { FadeIn, FadeInDown, Layout } from "react-native-reanimated";
import { SafeAreaView } from 'react-native-safe-area-context';
import ClanCrest from '../../components/ClanCrest';
import { Text } from "../../components/Text";
import apiFetch from "../../utils/apiFetch";

import PeakBadge from "../../components/PeakBadge";
import { SyncLoading } from "../../components/SyncLoading";

// ⚡️ HELPER: RESOLVE AURA TIER (Weekly Glory)
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

    if (!rank || rank > 10 || rank <= 0) return fallback; // Return object, not undefined

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

// ⚡️ HELPER: RESOLVE RPG CLASS (Lifetime Aura)
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

    return {
        title: currentTier.title.toUpperCase().replace(/ /g, "_"),
        icon: currentTier.icon,
        color: currentTier.color
    };
};

const formatCoins = (num) => {
    if (!num) return "0";
    if (num >= 1000000) return Math.floor(num / 1000000) + 'M+';
    if (num >= 1000) return Math.floor(num / 1000) + 'k+';
    return num.toString();
};

// --- AUTHOR CARD COMPONENT ---
const AuthorCard = ({ author, isDark }) => {
    // ⚡️ Read RPG Class
    const writerRank = resolveUserRank(author.currentRankLevel, author.aura);
    // ⚡️ Read Weekly Glory
    const tier = getAuraTier(author.previousRank);

    return (
        <Animated.View entering={FadeInDown.duration(400)} layout={Layout.springify()}>
            <TouchableOpacity
                onPress={() => DeviceEventEmitter.emit("navigateSafely", `/author/${author._id}`)}
                className={`mb-3 p-4 rounded-3xl border ${isDark ? "bg-[#0f0f0f] border-zinc-800" : "bg-white border-zinc-100 shadow-sm"
                    }`}
            >
                <View className="flex-row items-center">
                    <View style={{ borderColor: tier.color }} className="w-16 h-16 rounded-full border-2 p-0.5">
                        <Image
                            source={{ uri: author.profilePic?.url || "https://oreblogda.com/default-avatar.png" }}
                            className="w-full h-full rounded-full bg-zinc-200 dark:bg-zinc-800"
                        />
                    </View>

                    <View className="flex-1 ml-4 justify-center">
                        <View className="flex-row items-center justify-between mb-1">
                            <View className="flex-row items-center flex-1 mr-2">
                                <Text numberOfLines={1} className={`font-black italic uppercase tracking-tighter text-lg ${isDark ? 'text-white' : 'text-black'}`}>
                                    {author.username}
                                </Text>
                                {(author.peakLevel && author.peakLevel > 0) ? (
                                    <View className="ml-1">
                                        <PeakBadge level={author.peakLevel} size={20} />
                                    </View>
                                ) : null}
                            </View>
                            <View style={{ backgroundColor: `${tier.color}20`, borderColor: `${tier.color}40` }} className="px-2 py-0.5 rounded-md border flex-row items-center gap-1">
                                <MaterialCommunityIcons name={tier.icon} size={8} color={tier.color} />
                                <Text style={{ color: tier.color }} className="text-[8px] font-black uppercase tracking-widest">{tier.label}</Text>
                            </View>
                        </View>

                        {/* ⚡️ RENDER RPG CLASS TITLE */}
                        <View className="flex-row items-center mb-1">
                            <Text className="text-[10px] font-black italic" style={{ color: writerRank.color }}>
                                {writerRank.icon} {writerRank.title}
                            </Text>
                        </View>

                        <Text numberOfLines={1} className={`text-[11px] font-medium italic mb-2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                            {author.description || "No bio decrypted yet..."}
                        </Text>

                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center gap-3">
                                <View className="flex-row items-center">
                                    <Ionicons name="flame" size={12} color="#f97316" />
                                    <Text className="text-[10px] font-bold ml-1 text-zinc-500">{author.lastStreak || 0}</Text>
                                </View>
                                {/* ⚡️ Still showing Docs count as requested */}
                                <View className="flex-row items-center">
                                    <Ionicons name="document-text" size={12} color="#3b82f6" />
                                    <Text className="text-[10px] font-bold ml-1 text-zinc-500">{formatCoins(author.postsCount)}</Text>
                                </View>
                            </View>
                            {/* ⚡️ Render Lifetime Aura (instead of just weekly) */}
                            <View className={`${isDark ? 'bg-zinc-800' : 'bg-zinc-100'} px-2 py-0.5 rounded-full border ${isDark ? 'border-zinc-700' : 'border-zinc-200'}`}>
                                <Text style={{ color: writerRank.color }} className="text-[9px] font-black uppercase tracking-widest">
                                    AURA: {formatCoins(author.aura || 0)}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const resolveClanTier = (rank) => {
    const CLAN_TIERS = {
        6: { label: 'VI', color: '#ef4444', title: "The Akatsuki" },
        5: { label: 'V', color: '#e0f2fe', title: "The Espada" },
        4: { label: 'IV', color: '#a855f7', title: "Phantom Troupe" },
        3: { label: 'III', color: '#60a5fa', title: "Upper Moon" },
        2: { label: 'II', color: '#10b981', title: "Squad 13" },
        1: { label: 'I', color: '#94a3b8', title: "Wandering Ronin" },
    };
    if (rank === 1) return CLAN_TIERS[1];
    if (rank <= 3) return CLAN_TIERS[2];
    if (rank <= 10) return CLAN_TIERS[3];
    if (rank <= 25) return CLAN_TIERS[4];
    if (rank <= 50) return CLAN_TIERS[5];
    return CLAN_TIERS[6];
};

const ClanCard = ({ clan, isDark }) => {
    const badgeCount = clan.badges ? clan.badges.length : 0;
    const isWar = clan.isInWar;

    return (
        <Animated.View entering={FadeInDown.duration(400)} layout={Layout.springify()}>
            <TouchableOpacity
                onPress={() => DeviceEventEmitter.emit("navigateSafely", `/clans/${clan.tag}`)}
                className={`mb-3 mx-1 rounded-3xl border overflow-hidden relative ${isDark ? "bg-[#0f0f0f] border-zinc-800" : "bg-white border-zinc-100 shadow-sm"
                    }`}
                style={{
                    shadowColor: isWar ? "#ef4444" : "#000",
                    shadowOpacity: isWar ? 0.3 : 0.1,
                    shadowRadius: isWar ? 10 : 4,
                    borderColor: isWar ? 'rgba(239, 68, 68, 0.4)' : isDark ? '#27272a' : '#f4f4f5'
                }}
            >
                {isWar && (
                    <View className="absolute top-0 right-0 z-20 bg-red-600/90 px-3 py-1 rounded-bl-xl">
                        <View className="flex-row items-center gap-1">
                            <MaterialCommunityIcons name="sword-cross" size={12} color="white" />
                            <Text className="text-white text-[9px] font-black uppercase tracking-widest">
                                WAR ACTIVE
                            </Text>
                        </View>
                    </View>
                )}

                <View className="p-4 flex-row items-center">
                    <View className="mr-4 items-center justify-center">
                        <ClanCrest rank={clan.rank || 1} isFeed={true} size={70} />
                        <View className="mt-2 bg-zinc-900/80 px-2 py-0.5 rounded-full border border-zinc-800">
                            <Text className="text-zinc-400 text-[8px] font-bold uppercase">
                                LVL {clan.rank || 1}
                            </Text>
                        </View>
                    </View>

                    <View className="flex-1 justify-center">
                        <View className="flex-row items-center justify-between mb-1 pr-2">
                            <View className="flex-1 mr-2">
                                <Text numberOfLines={1} className={`font-black italic uppercase text-lg ${isDark ? 'text-white' : 'text-black'}`}>
                                    {clan.name}
                                </Text>
                            </View>
                            <View className={`px-2 py-0.5 rounded-md border ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-100 border-zinc-200'}`}>
                                <Text className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                                    [{clan.tag}]
                                </Text>
                            </View>
                        </View>

                        <Text numberOfLines={1} className={`text-[11px] font-medium italic mb-3 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                            {clan.description || "A powerful alliance awaiting destiny..."}
                        </Text>

                        <View className={`flex-row items-center justify-between border-t pt-2 ${isDark ? 'border-zinc-800/50' : 'border-zinc-100'}`}>
                            <View className="flex-row items-center">
                                <Ionicons name="people" size={12} color={isDark ? "#a1a1aa" : "#71717a"} />
                                <Text className={`text-[10px] font-bold ml-1.5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                    {formatCoins(clan.memberCount || 0)}
                                </Text>
                            </View>

                            <View className="flex-row items-center">
                                <Ionicons name="heart" size={12} color="#f472b6" />
                                <Text className={`text-[10px] font-bold ml-1.5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                    {formatCoins(clan.followerCount || 0)}
                                </Text>
                            </View>

                            <View className="flex-row items-center">
                                <MaterialCommunityIcons name="trophy" size={12} color="#fbbf24" />
                                <Text className={`text-[10px] font-bold ml-1.5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                    {badgeCount}
                                </Text>
                            </View>

                            {clan.isRecruiting && (
                                <View className="flex-row items-center bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                    <View className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />
                                    <Text className="text-[8px] font-bold text-emerald-500 uppercase">
                                        OPEN
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const PostSearchCard = ({ item, isDark }) => {
    return (
        <Animated.View entering={FadeIn.duration(500)} layout={Layout.springify()}>
            <TouchableOpacity
                onPress={() => DeviceEventEmitter.emit("navigateSafely", `/post/${item._id}`)}
                className={`mb-5 rounded-[2.5rem] border overflow-hidden ${isDark ? "bg-zinc-900/40 border-zinc-800" : "bg-white border-zinc-100 shadow-sm"}`}
            >
                {item.mediaUrl ? (
                    <Image source={{ uri: item.mediaUrl }} className="w-full h-48 bg-zinc-800" resizeMode="cover" />
                ) : (
                    <View className="w-full h-2 bg-blue-600" />
                )}

                <View className="p-5">
                    <View className="flex-row justify-between items-center mb-3">
                        <View className="bg-blue-600/10 border border-blue-500/20 px-3 py-1 rounded-full">
                            <Text className="text-blue-500 text-[8px] font-black uppercase tracking-widest">{item.category}</Text>
                        </View>
                        <Text className="text-zinc-500 text-[10px] font-bold uppercase tracking-tighter">
                            <Text className={`${isDark ? 'text-zinc-600' : 'text-zinc-400'} font-normal`}>OP:</Text> {item.authorName}
                        </Text>
                    </View>

                    <Text className={`font-black text-xl mb-2 leading-tight tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>{item.title}</Text>
                    <Text className={`${isDark ? 'text-zinc-400' : 'text-zinc-500'} text-xs mb-5 italic`} numberOfLines={2}>{item.message}</Text>

                    <View className={`flex-row items-center justify-between pt-4 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
                        <View className="flex-row items-center gap-5">
                            <View className="flex-row items-center">
                                <Ionicons name="heart-sharp" size={14} color="#ef4444" />
                                <Text className="text-[11px] font-black text-zinc-500 ml-1.5">{item.likesCount || 0}</Text>
                            </View>
                            <View className="flex-row items-center">
                                <Ionicons name="chatbubble-ellipses" size={14} color="#3b82f6" />
                                <Text className="text-[11px] font-black text-zinc-500 ml-1.5">{item.commentsCount || 0}</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const SearchScreen = () => {
    const storage = useMMKV();
    const router = useRouter();
    const systemTheme = useColorScheme();
    const isDark = systemTheme === 'dark';

    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [results, setResults] = useState({ players: [], clans: [], posts: [] });
    const [activeTab, setActiveTab] = useState("all");
    const [recentSearches, setRecentSearches] = useState([]);
    const [trending] = useState(["Solo Leveling", "Genshin Build", "Aura Guide", "Top Clans", "Winter 2026 Anime"]);
    const [isOffline, setIsOffline] = useState(false);

    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        try {
            const saved = storage.getString('recent_searches');
            if (saved) setRecentSearches(JSON.parse(saved));
        } catch (e) {
            console.error("Cache load error:", e);
        }
    }, [storage]);

    const saveSearch = useCallback((text) => {
        if (!text || text.length < 2) return;

        setRecentSearches(prevSearches => {
            if (prevSearches[0] === text) return prevSearches;

            const updated = [text, ...prevSearches.filter(s => s !== text)].slice(0, 5);
            try {
                storage.set('recent_searches', JSON.stringify(updated));
            } catch (e) {
                console.error("Cache save error:", e);
            }
            return updated;
        });
    }, [storage]);

    const performSearch = useCallback(async (text, pageNum = 1, shouldAppend = false) => {
        if (text.length < 2) {
            setResults({ players: [], clans: [], posts: [] });
            return;
        }

        if (pageNum === 1) setLoading(true);
        else setLoadingMore(true);
        setIsOffline(false);

        try {
            const response = await apiFetch(`/search?q=${encodeURIComponent(text)}&page=${pageNum}&limit=10`);
            const data = await response.json();

            if (response.ok) {
                setResults(prev => ({
                    players: shouldAppend ? prev.players : (data.players || []),
                    clans: shouldAppend ? prev.clans : (data.clans || []),
                    posts: shouldAppend ? [...prev.posts, ...data.posts] : (data.posts || [])
                }));
                setHasMore(data.pagination?.hasNextPage);
            } else {
                setIsOffline(true);
            }
        } catch (error) {
            console.error("Search Error:", error);
            setIsOffline(true);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, []);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            setPage(1);
            if (query.length >= 2) {
                performSearch(query, 1, false);
                saveSearch(query);
            } else {
                setResults({ players: [], clans: [], posts: [] });
            }
        }, 1000)
        return () => clearTimeout(delayDebounceFn);
    }, [query, performSearch, saveSearch]);

    const handleLoadMore = () => {
        if (!loadingMore && hasMore && query.length > 1 && !isOffline) {
            const nextPage = page + 1;
            setPage(nextPage);
            performSearch(query, nextPage, true);
        }
    };

    const listData = useMemo(() => {
        const rawResults = [
            ...(activeTab === 'all' || activeTab === 'players' ? results.players : []),
            ...(activeTab === 'all' || activeTab === 'clans' ? results.clans : []),
            ...(activeTab === 'all' || activeTab === 'posts' ? results.posts : [])
        ];

        return rawResults;
    }, [results, activeTab]);

    const renderItem = ({ item }) => {
        if (item.username) return <AuthorCard author={item} isDark={isDark} />;
        if (item.tag) return <ClanCard clan={item} isDark={isDark} />;
        return <PostSearchCard item={item} isDark={isDark} />;
    };

    return (
        <SafeAreaView className={`flex-1 ${isDark ? "bg-[#050505]" : "bg-white"}`}>

            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
            {/* Header / Search Bar */}
            <View className={`px-4 pb-3 flex-row items-center`}>
                <TouchableOpacity onPress={() => router.back()} className="pr-3">
                    <Ionicons name="chevron-back" size={32} color={isDark ? "white" : "black"} />
                </TouchableOpacity>
                <View className={`flex-1 flex-row items-center px-4 h-14 rounded-2xl border ${isDark ? 'bg-zinc-900 border-blue-900/30' : 'bg-gray-100 border-gray-200'}`}>
                    <Ionicons name="search" size={22} color="#3b82f6" />
                    <TextInput
                        placeholder="SCAN_DATA_STREAM..."
                        placeholderTextColor={isDark ? "#3f3f46" : "#a1a1aa"}
                        className={`flex-1 ml-3 font-bold text-sm tracking-widest ${isDark ? 'text-white' : 'text-black'}`}
                        value={query}
                        onChangeText={(t) => {
                            setQuery(t);
                            if (isOffline) setIsOffline(false);
                        }}
                        autoFocus
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={() => setQuery("")}>
                            <Ionicons name="close-circle" size={20} color={isDark ? "#52525b" : "#d1d5db"} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Main Content Area */}
            {query.length < 2 ? (
                <ScrollView
                    className="flex-1 px-6"
                    keyboardShouldPersistTaps="handled"
                >
                    <View className="mt-8">
                        <Text className="text-blue-500 font-black text-[10px] uppercase tracking-[0.4em] mb-6">Recent_Inquiries</Text>
                        {recentSearches.length > 0 ? (
                            recentSearches.map((s, i) => (
                                <TouchableOpacity key={i} onPress={() => setQuery(s)} className="flex-row items-center mb-6">
                                    <Ionicons name="refresh-circle-outline" size={20} color={isDark ? "#3f3f46" : "#d1d5db"} />
                                    <Text className={`${isDark ? 'text-zinc-400' : 'text-zinc-600'} ml-4 font-bold text-lg italic`}>{s}</Text>
                                    <Ionicons name="arrow-forward" size={14} color={isDark ? "#18181b" : "#f4f4f5"} className="ml-auto" />
                                </TouchableOpacity>
                            ))
                        ) : (
                            <Text className="text-zinc-400 italic text-sm mb-6">Clear history found.</Text>
                        )}

                        <Text className="text-purple-500 font-black text-[10px] uppercase tracking-[0.4em] mb-6 mt-4">Trending_Sectors</Text>
                        <View className="flex-row flex-wrap gap-2">
                            {trending.map((item, i) => (
                                <TouchableOpacity
                                    key={i}
                                    onPress={() => setQuery(item)}
                                    className={`${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-gray-100 border-gray-200'} border px-4 py-2 rounded-full`}
                                >
                                    <Text className={`${isDark ? 'text-zinc-400' : 'text-zinc-600'} font-bold text-xs uppercase italic`}># {item}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </ScrollView>
            ) : (
                <>
                    {!isOffline && (
                        <View className="flex-row px-4 py-3 gap-2">
                            {['all', 'players', 'clans', 'posts'].map((tab) => (
                                <TouchableOpacity
                                    key={tab}
                                    onPress={() => setActiveTab(tab)}
                                    className={`px-4 py-2 rounded-xl border ${activeTab === tab ? "bg-blue-600 border-blue-600 shadow-sm" : isDark ? "bg-transparent border-zinc-800" : "bg-gray-50 border-gray-200"}`}
                                >
                                    <Text className={`text-[10px] font-black uppercase tracking-widest ${activeTab === tab ? "text-white" : "text-zinc-500"}`}>{tab}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    <View className="flex-1 px-4 mt-2">
                        {loading && page === 1 ? (
                            <View className="flex-1 justify-center items-center">
                                <SyncLoading message="Establishing Link...." />
                            </View>
                        ) : isOffline ? (
                            <Animated.View entering={FadeIn.duration(400)} className="flex-1 items-center justify-center px-10">
                                <MaterialCommunityIcons name="wifi-strength-1-alert" size={80} color="#ef4444" className="opacity-50" />
                                <Text className="text-red-500 font-black text-xl italic uppercase tracking-tighter mt-4 text-center">Signal Interrupted</Text>
                                <Text className="text-zinc-500 text-center mt-2 mb-8 font-medium italic">
                                    The data stream is currently offline. Please check your neural connection.
                                </Text>
                                <TouchableOpacity
                                    onPress={() => performSearch(query, 1, false)}
                                    className="bg-red-500/10 border border-red-500/20 px-8 py-3 rounded-full flex-row items-center gap-2"
                                >
                                    <Ionicons name="refresh" size={18} color="#ef4444" />
                                    <Text className="text-red-500 font-black uppercase tracking-widest text-xs">Retry Scan</Text>
                                </TouchableOpacity>
                            </Animated.View>
                        ) : (
                            <View style={{ flex: 1 }}>
                                {/* ⚡️ Swapped to LegendList */}
                                <LegendList
                                    data={listData}
                                    keyExtractor={(item, index) => item._id || index.toString()}
                                    renderItem={renderItem}
                                    estimatedItemSize={180}
                                    removeClippedSubviews={true}
                                    drawDistance={2000}
                                    recycleItems={true}
                                    keyboardShouldPersistTaps="handled"
                                    onEndReached={handleLoadMore}
                                    onEndReachedThreshold={0.5}
                                    ListFooterComponent={() => loadingMore ? (
                                        <View className="py-6">
                                            <ActivityIndicator color="#2563eb" />
                                        </View>
                                    ) : null}
                                    ListEmptyComponent={() => (
                                        <View className="mt-20 items-center opacity-40">
                                            <Ionicons name="scan-outline" size={80} color={isDark ? "#3f3f46" : "#d1d5db"} />
                                            <Text className="text-zinc-500 font-black mt-4 text-center tracking-widest uppercase text-xs">No matching frequencies detected.</Text>
                                        </View>
                                    )}
                                    showsVerticalScrollIndicator={false}
                                    contentContainerStyle={{ paddingBottom: 60 }}
                                />
                            </View>
                        )}
                    </View>
                </>
            )}
        </SafeAreaView>
    );
};

export default SearchScreen;