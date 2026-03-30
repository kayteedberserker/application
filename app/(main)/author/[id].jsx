import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from 'expo-sharing';
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useRef, useState, useMemo, memo } from "react";
import {
    DeviceEventEmitter,
    Dimensions,
    Modal,
    Pressable,
    ScrollView,
    TouchableOpacity,
    View,
    Image,
    InteractionManager
} from "react-native";
import { useMMKV } from 'react-native-mmkv';
import { LegendList } from "@legendapp/list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ViewShot from "react-native-view-shot";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    Easing,
    interpolate,
    FadeInDown
} from "react-native-reanimated";
import AuraAvatar from "../../../components/AuraAvatar";
import ClanBorder from "../../../components/ClanBorder";
import PlayerCard from "../../../components/PlayerCard";
import PostCard from "../../../components/PostCard";
import { SyncLoading } from "../../../components/SyncLoading";
import { Text } from "../../../components/Text";
import apiFetch from "../../../utils/apiFetch";

// ⚡️ IMPORTED EXTRACTED COMPONENTS
import PlayerNameplate from "../../../components/PlayerNameplate";
import PlayerBackground from "../../../components/PlayerBackground";
import PlayerWatermark from "../../../components/PlayerWatermark";
import BadgeIcon from "../../../components/BadgeIcon";

const API_BASE = "https://oreblogda.com/api";
const { width } = Dimensions.get('window');

// 🧠 Tier 1: Memory Cache
const AUTHOR_MEMORY_CACHE = {};
const AUTHOR_POSTS_MEMORY_CACHE = {};

// ⚡️ Helper function to format large numbers cleanly
const formatCoins = (num) => {
    if (!num) return "0";
    if (num >= 1000000) return Math.floor(num / 1000000) + 'M+';
    if (num >= 1000) return Math.floor(num / 1000) + 'k+';
    return num.toString();
};

const getAuraTier = (rank) => {
    const MONARCH_GOLD = '#fbbf24';
    const CRIMSON_RED = '#ef4444';
    const SHADOW_PURPLE = '#a855f7';
    const STEEL_BLUE = '#3b82f6';
    const REI_WHITE = '#e0f2fe';

    if (!rank || rank > 10 || rank <= 0) {
        return { color: '#3b82f6', label: 'ACTIVE', icon: 'radar' };
    }

    switch (rank) {
        case 1: return { color: MONARCH_GOLD, label: 'MONARCH', icon: 'crown' };
        case 2: return { color: CRIMSON_RED, label: 'YONKO', icon: 'flare' };
        case 3: return { color: SHADOW_PURPLE, label: 'KAGE', icon: 'moon-waxing-crescent' };
        case 4: return { color: STEEL_BLUE, label: 'SHOGUN', icon: 'shield-star' };
        case 5: return { color: REI_WHITE, label: 'ESPADA 0', icon: 'skull' };
        case 6: return { color: '#cbd5e1', label: 'ESPADA 1', icon: 'sword-cross' };
        case 7: return { color: '#94a3b8', label: 'ESPADA 2', icon: 'sword-cross' };
        case 8: return { color: '#64748b', label: 'ESPADA 3', icon: 'sword-cross' };
        case 9: return { color: '#475569', label: 'ESPADA 4', icon: 'sword-cross' };
        case 10: return { color: '#334155', label: 'ESPADA 5', icon: 'sword-cross' };
        default: return { color: '#1e293b', label: 'VANGUARD', icon: 'shield-check' };
    }
};

// ⚡️ NEW: The Master Aura Tiers with injected Colors for the UI
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
        progress: Math.min(Math.max(progress, 0), 100),
        req: currentTier.req,
        nextReq: nextTier.req
    };
};

// ⚡️ PERFORMANCE FIX 1: Memoized Post Item
const MemoizedPostItem = memo(({ item, isVisible, authorData }) => {
    return (
        <View className="px-3">
            <PostCard
                post={item}
                authorData={authorData}
                clanData={item.clanData}
                isFeed
                isVisible={isVisible}
            />
        </View>
    );
}, (prevProps, nextProps) => {
    return prevProps.isVisible === nextProps.isVisible && prevProps.item === nextProps.item;
});

export default function AuthorPage() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";
    const storage = useMMKV();

    const CACHE_KEY_AUTHOR = `author_data_${id}`;
    const CACHE_KEY_POSTS = `author_posts_${id}`;

    const [author, setAuthor] = useState(AUTHOR_MEMORY_CACHE[CACHE_KEY_AUTHOR] || null);
    const [posts, setPosts] = useState(AUTHOR_POSTS_MEMORY_CACHE[CACHE_KEY_POSTS] || []);

    const [totalPosts, setTotalPosts] = useState(0);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    const [isInitialMount, setIsInitialMount] = useState(true);
    const [cardPreviewVisible, setCardPreviewVisible] = useState(false);
    
    // ⚡️ PERFORMANCE FIX 2: Visibility Tracking State
    const [visibleIds, setVisibleIds] = useState(new Set());

    const scrollRef = useRef(null);
    const playerCardRef = useRef(null);

    const pulseAnim = useSharedValue(1);
    const rotationAnim = useSharedValue(0);
    const skeletonFade = useSharedValue(0.3);

    const auraRank = author?.previousRank || null;
    const aura = getAuraTier(auraRank);
    const equippedGlow = author?.inventory?.find(i => i.category === 'GLOW' && i.isEquipped);
    const activeGlowColor = equippedGlow?.visualConfig?.primaryColor || null;
    const themeColor = activeGlowColor || aura.color;

    useEffect(() => {
        pulseAnim.value = withRepeat(withSequence(withTiming(1.1, { duration: 2000 }), withTiming(1, { duration: 2000 })), -1, true);
        rotationAnim.value = withRepeat(withTiming(1, { duration: 20000, easing: Easing.linear }), -1, false);
        skeletonFade.value = withRepeat(withSequence(withTiming(0.7, { duration: 800 }), withTiming(0.3, { duration: 800 })), -1, true);
    }, []);

    const scanAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${interpolate(rotationAnim.value, [0, 1], [0, 360])}deg` }],
        borderColor: `${themeColor}40`
    }));

    const auraPulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseAnim.value }],
        backgroundColor: themeColor
    }));

    const skeletonAnimatedStyle = useAnimatedStyle(() => ({
        opacity: skeletonFade.value
    }));

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener("doScrollToTop", () => {
            scrollRef.current?.scrollToOffset({ offset: 0, animated: true });
        });
        return () => sub.remove();
    }, []);

    const saveHeavyCache = useCallback((key, data) => {
        try {
            const cacheEntry = { data: data, timestamp: Date.now() };
            storage.set(key, JSON.stringify(cacheEntry));
        } catch (e) { console.error("Cache Save Error", e); }
    }, [storage]);

    const fetchInitialData = useCallback(async () => {
        setLoading(true);
        setIsOffline(false);
        try {
            const [userRes, postRes] = await Promise.all([
                apiFetch(`/users/${id}`),
                apiFetch(`/posts?author=${id}&page=1&limit=10`),
            ]);

            const userData = await userRes.json();
            const postData = await postRes.json();

            if (userRes.ok) {
                setAuthor(userData.user);
                AUTHOR_MEMORY_CACHE[CACHE_KEY_AUTHOR] = userData.user;
                saveHeavyCache(CACHE_KEY_AUTHOR, userData.user);
            }
            if (postRes.ok) {
                setPosts(postData.posts);
                setTotalPosts(postData.total || postData.posts.length);
                setHasMore(postData.posts.length >= 6);
                AUTHOR_POSTS_MEMORY_CACHE[CACHE_KEY_POSTS] = postData.posts;
                saveHeavyCache(CACHE_KEY_POSTS, postData.posts);
            }
        } catch (error) {
            console.error("Fetch error:", error);
            setIsOffline(true);
        } finally {
            setLoading(false);
            // Allow UI to paint before lifting initial mount shield
            InteractionManager.runAfterInteractions(() => {
                setTimeout(() => setIsInitialMount(false), 500);
            });
        }
    }, [id, CACHE_KEY_AUTHOR, CACHE_KEY_POSTS, saveHeavyCache]);

    const fetchMorePosts = useCallback(async () => {
        if (!hasMore || loading || posts.length === 0 || isOffline) return;
        const nextPage = page + 1;
        setLoading(true);
        try {
            const res = await apiFetch(`${API_BASE}/posts?author=${id}&page=${nextPage}&limit=10`);
            const data = await res.json();
            if (res.ok && data.posts.length > 0) {
                setPosts((prev) => {
                    const updated = [...prev, ...data.posts];
                    AUTHOR_POSTS_MEMORY_CACHE[CACHE_KEY_POSTS] = updated;
                    return updated;
                });
                setTotalPosts(data.total);
                setPage(nextPage);
                setHasMore(data.posts.length >= 6);
            } else { setHasMore(false); }
        } catch (error) { console.error("Load more error:", error); } finally { setLoading(false); }
    }, [hasMore, loading, posts.length, isOffline, page, id, CACHE_KEY_POSTS]);

    useEffect(() => {
        const init = () => {
            if (AUTHOR_MEMORY_CACHE[CACHE_KEY_AUTHOR]) {
                setIsInitialMount(false);
                fetchInitialData();
                return;
            }
            try {
                const cAuth = storage.getString(CACHE_KEY_AUTHOR);
                const cPosts = storage.getString(CACHE_KEY_POSTS);

                if (cAuth) {
                    const parsed = JSON.parse(cAuth);
                    const authorData = parsed?.data || parsed;
                    setAuthor(authorData);
                    AUTHOR_MEMORY_CACHE[CACHE_KEY_AUTHOR] = authorData;
                }
                if (cPosts) {
                    const parsed = JSON.parse(cPosts);
                    const postData = parsed?.data || parsed;
                    setPosts(postData);
                    AUTHOR_POSTS_MEMORY_CACHE[CACHE_KEY_POSTS] = postData;
                    setIsInitialMount(false);
                }
            } catch (e) { console.error("MMKV Init Error", e); }

            fetchInitialData();
        };
        init();
    }, [id, CACHE_KEY_AUTHOR, CACHE_KEY_POSTS, fetchInitialData, storage]);

    const captureAndShare = async () => {
        try {
            if (playerCardRef.current) {
                const uri = await playerCardRef.current.capture();
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri);
                }
            }
        } catch (error) { console.error("Capture Error:", error); }
    };

    // ⚡️ PERFORMANCE FIX 3: Viewability Config & Callback
    const onViewableItemsChanged = useRef(({ viewableItems }) => {
        const newVisible = new Set(viewableItems.map(v => v.item._id));
        setVisibleIds(newVisible);
    }).current;

    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

    // ⚡️ PERFORMANCE FIX 4: Throttled Scroll Emitter
    const lastScrollY = useRef(0);
    const handleScroll = useCallback((e) => {
        const offsetY = e.nativeEvent.contentOffset.y;
        if (Math.abs(offsetY - lastScrollY.current) > 20) {
            DeviceEventEmitter.emit("onScroll", offsetY);
            lastScrollY.current = offsetY;
        }
    }, []);

    const renderItem = useCallback(({ item }) => (
        <MemoizedPostItem 
            item={item} 
            isVisible={visibleIds.has(item._id)} 
            authorData={author} 
        />
    ), [visibleIds, author]);

    const AuthorSkeleton = useCallback(() => (
        <View className="px-4 pt-20 pb-6 opacity-40">
            <View className="p-6 bg-gray-100 dark:bg-[#111] border border-gray-200 dark:border-gray-800 rounded-[40px] items-center">
                <Animated.View style={[skeletonAnimatedStyle]} className="w-32 h-32 bg-gray-300 dark:bg-gray-800 rounded-full mb-6" />
                <Animated.View style={[skeletonAnimatedStyle]} className="w-48 h-8 bg-gray-300 dark:bg-gray-800 rounded-lg mb-4" />
            </View>
        </View>
    ), [skeletonAnimatedStyle]);

    const ListHeader = useCallback(() => {
        if (!author && isOffline) return <AuthorSkeleton />;
        if (!author) return null;

        // ⚡️ Update to Use RPG Ranks
        const totalAura = author.aura || 0;
        const rankLevel = author.currentRankLevel || 1;
        const writerRank = resolveUserRank(rankLevel, totalAura);

        const favoriteCharacter = author?.preferences?.favCharacter || "NONE_SET";

        const equippedBadges = author.inventory?.filter(i => i.category === 'BADGE' && i.isEquipped).slice(0, 10) || [];
        const equippedBg = author.inventory?.find(i => i.category === 'BACKGROUND' && i.isEquipped);
        const equippedBorder = author.inventory?.find(i => i.category === 'BORDER' && i.isEquipped);
        const borderVisual = equippedBorder?.visualConfig || {};
        const equippedWatermark = author.inventory?.find(i => i.category === 'WATERMARK' && i.isEquipped);

        const HeaderCard = (
            <View className="relative p-6 bg-white dark:bg-[#0a0a0a] shadow-2xl rounded-[25px] overflow-hidden">
                <View className="absolute top-5 right-5 z-50 items-end gap-2">
                    <TouchableOpacity
                        onPress={() => setCardPreviewVisible(true)}
                        activeOpacity={0.7}
                        className="bg-gray-100/80 dark:bg-white/10 p-2 rounded-2xl border border-gray-200/50 dark:border-white/10"
                    >
                        <Ionicons name="card-outline" size={20} color={isDark ? "white" : "black"} />
                    </TouchableOpacity>
                </View>

                <PlayerBackground equippedBg={equippedBg} themeColor={themeColor} borderRadius={25} />
                <PlayerWatermark equippedWatermark={equippedWatermark} isDark={isDark} />

                <View className="flex-col items-center gap-6">
                    <View className="relative items-center justify-center">
                        <Animated.View
                            style={[{ position: 'absolute', width: 140, height: 140, borderRadius: 100, opacity: activeGlowColor ? 0.25 : 0.1 }, auraPulseStyle]}
                        />
                        <Animated.View style={[{ width: 160, height: 160 }, scanAnimatedStyle]} className="absolute border border-dashed rounded-full" />
                        <AuraAvatar
                            author={{ ...author, rank: auraRank, image: author.profilePic?.url, name: author.username }}
                            aura={aura}
                            glowColor={activeGlowColor}
                            isTop10={auraRank > 0 && auraRank <= 10}
                            isDark={isDark}
                            size={130}
                        />

                        {auraRank > 0 && (
                            <View style={{ backgroundColor: themeColor }} className="absolute -bottom-3 px-4 py-1 rounded-full border-2 border-white dark:border-black shadow-lg z-20">
                                <View className="flex-row items-center gap-1">
                                    <MaterialCommunityIcons name={aura.icon} size={10} color={auraRank === 5 || activeGlowColor ? "black" : "white"} />
                                    <Text style={{ color: auraRank === 5 || activeGlowColor ? "black" : "white" }} className="text-[9px] font-black uppercase tracking-widest">{aura.label} #{auraRank}</Text>
                                </View>
                            </View>
                        )}
                    </View>

                    <View className="items-center w-full mt-2">
                        <View className="items-center justify-center mb-3">
                            <PlayerNameplate
                                author={author}
                                themeColor={themeColor}
                                equippedGlow={equippedGlow}
                                auraRank={auraRank}
                                isDark={isDark}
                                fontSize={24}
                            />

                            {equippedBadges.length > 0 && (
                                <View className="flex-row flex-wrap justify-center gap-2 mt-2 mb-3">
                                    {equippedBadges.map((badge, bIdx) => (
                                        <BadgeIcon key={`spec-${bIdx}`} badge={badge} size={22} isDark={isDark} />
                                    ))}
                                </View>
                            )}
                        </View>

                        <Text className="text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed font-medium px-8 italic mb-4">
                            "{author.description || "This operator is a ghost in the machine..."}"
                        </Text>

                        <View className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl px-5 py-2 flex-row items-center mb-1">
                            <MaterialCommunityIcons name="shield-star-outline" size={14} color={themeColor} />
                            <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">GOAT:</Text>
                            <Text className="text-[10px] font-black uppercase tracking-widest text-gray-900 dark:text-white ml-2 italic">{favoriteCharacter}</Text>
                        </View>

                        <View className="flex-row gap-8 mt-6 border-y border-gray-100 dark:border-gray-800 w-full py-4 justify-center">
                            <View className="items-center">
                                <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Aura</Text>
                                <Text className="text-lg font-black" style={{ color: themeColor }}>{totalAura.toLocaleString()}</Text>
                            </View>
                            <View className="items-center">
                                <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Glory</Text>
                                <Text className="text-lg font-black" style={{ color: '#ec4899' }}>+{author.weeklyAura || 0}</Text>
                            </View>
                            <View className="items-center">
                                <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Logs</Text>
                                <Text className="text-lg font-black dark:text-white">{totalPosts}</Text>
                            </View>
                        </View>

                        <View className="mt-8 w-full px-2">
                            <View className="flex-row justify-between items-end mb-2">
                                <View className="flex-row items-center gap-2">
                                    <Text className="text-2xl">{writerRank.icon}</Text>
                                    <View>
                                        <Text style={{ color: writerRank.color }} className="text-[8px] font-mono uppercase tracking-[0.2em] leading-none mb-1">Class</Text>
                                        <Text className="text-sm font-black uppercase tracking-tighter dark:text-white">{writerRank.title}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            </View>
        );

        return (
            <View className="px-4 pt-20 pb-6">
                {equippedBorder ? (
                    <ClanBorder
                        color={borderVisual.primaryColor || themeColor}
                        secondaryColor={borderVisual.secondaryColor || null}
                        animationType={borderVisual.animationType || "singleSnake"}
                        snakeLength={borderVisual.snakeLength || 120}
                        duration={borderVisual.duration || 3000}
                    >
                        {HeaderCard}
                    </ClanBorder>
                ) : HeaderCard}

                <View className="flex-row items-center gap-4 mt-10 mb-4 px-2">
                    <Text className="text-xl font-black italic uppercase tracking-tighter text-gray-900 dark:text-white">
                        Diary<Text style={{ color: themeColor }}> Archives </Text>
                    </Text>
                    <View className="h-[1px] flex-1 bg-gray-100 dark:bg-gray-800" />
                </View>
            </View>
        );
    }, [author, isOffline, isDark, themeColor, activeGlowColor, aura, auraRank, totalPosts, scanAnimatedStyle, auraPulseStyle, skeletonAnimatedStyle]);

    if (!author && isOffline) {
        return (
            <ScrollView className="flex-1 bg-white dark:bg-[#0a0a0a]" contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
                <AuthorSkeleton />
                <View className="items-center justify-center px-10 -mt-10">
                    <MaterialCommunityIcons name="wifi-strength-1-alert" size={48} color="#ef4444" />
                    <Text className="text-2xl font-black uppercase italic text-red-600 mt-4">Signal Interrupted</Text>
                    <Text className="text-center text-gray-500 dark:text-gray-400 mt-2 mb-8 font-medium">Neural link to the central database has been severed. Showing cached records.</Text>
                    <TouchableOpacity onPress={fetchInitialData} className="bg-red-600 px-8 py-3 rounded-full flex-row items-center gap-2 shadow-lg">
                        <Ionicons name="refresh" size={18} color="white" />
                        <Text className="text-white font-black uppercase tracking-widest text-xs">Reconnect</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        );
    }

    return (
        <View className="flex-1 bg-white dark:bg-[#0a0a0a]">
            {/* ⚡️ PERFORMANCE FIX 5: Full LegendList Config */}
            <LegendList
                ref={scrollRef}
                data={posts}
                keyExtractor={(item) => item._id}
                renderItem={renderItem}
                ListHeaderComponent={ListHeader}

                estimatedItemSize={500}
                drawDistance={1000}
                recycleItems={true}
                
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                onScroll={handleScroll}
                scrollEventThrottle={16}

                contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}

                ListFooterComponent={
                    <View className="py-10">
                        {isInitialMount &&
                            <View style={{ backgroundColor: isDark ? "#050505" : "#ffffff" }} className="flex-1 h-full mt-[70%] items-center justify-center">
                                <SyncLoading message='Decrypting Anime Intel' />
                            </View>
                        }
                        {loading && !isInitialMount && <SyncLoading message="Fetching Author Posts" />}
                        {!hasMore && posts.length > 0 && (
                            <View className="items-center opacity-30">
                                <View className="h-[1px] w-24 bg-gray-500 mb-4" />
                                <Text className="text-[10px] font-mono uppercase tracking-[0.4em] dark:text-white">End_Of_Transmission</Text>
                            </View>
                        )}
                    </View>
                }
                onEndReached={fetchMorePosts}
                onEndReachedThreshold={0.5}
            />

            {cardPreviewVisible && (
                <View style={{ position: 'absolute', left: -10000, opacity: 0 }} pointerEvents="none">
                    <ViewShot ref={playerCardRef} options={{ format: "png", quality: 1 }}>
                        <PlayerCard author={author} totalPosts={totalPosts} isDark={isDark} />
                    </ViewShot>
                </View>
            )}

            <Modal visible={cardPreviewVisible} transparent animationType="slide">
                <View className="flex-1 bg-black/95">
                    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }} showsVerticalScrollIndicator={false}>
                        <View className="w-full pt-10 items-center">
                            <View className="w-full flex-row justify-between items-center">
                                <View>
                                    <Text className="text-white font-black text-xl italic uppercase tracking-widest">Player Identity</Text>
                                    <Text className="text-gray-500 font-bold text-[9px] uppercase tracking-[0.4em] mt-1">Classified Records</Text>
                                </View>
                                <Pressable onPress={() => setCardPreviewVisible(false)} className="w-12 h-12 bg-white/10 rounded-full items-center justify-center">
                                    <Ionicons name="close" size={28} color="white" />
                                </Pressable>
                            </View>

                            {cardPreviewVisible && (
                                <View style={{ transform: [{ scale: Math.min(1, (width - 40) / 380) }], width: 380, alignItems: 'center' }}>
                                    <PlayerCard author={author} totalPosts={totalPosts} isDark={isDark} />
                                </View>
                            )}

                            <View className="w-full mt-6">
                                <TouchableOpacity onPress={captureAndShare} style={{ backgroundColor: themeColor }} className="flex-row items-center justify-center gap-3 w-full h-16 rounded-[30px] shadow-lg">
                                    <MaterialCommunityIcons name="share-variant" size={24} color="white" />
                                    <Text className="text-white font-black uppercase tracking-[0.2em] text-sm italic">Share Identity</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
}