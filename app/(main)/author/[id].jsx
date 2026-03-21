import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from 'expo-sharing';
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
    DeviceEventEmitter,
    Dimensions,
    Modal,
    Pressable,
    ScrollView,
    TouchableOpacity,
    View,
    Image
} from "react-native";
// ⚡️ Swapped FlashList for LegendList
import { useMMKV } from 'react-native-mmkv';
import { LegendList } from "@legendapp/list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop, SvgXml } from "react-native-svg";
import ViewShot from "react-native-view-shot";
// ⚡️ Imported Reanimated
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    Easing,
    interpolate
} from "react-native-reanimated";
import AuraAvatar from "../../../components/AuraAvatar";
import ClanBorder from "../../../components/ClanBorder";
import PlayerCard from "../../../components/PlayerCard";
import PostCard from "../../../components/PostCard";
import { SyncLoading } from "../../../components/SyncLoading";
import { Text } from "../../../components/Text";
import apiFetch from "../../../utils/apiFetch";

// ⚡️ Imported PeakBadge
import PeakBadge from "../../../components/PeakBadge";

const API_BASE = "https://oreblogda.com/api";
const { width } = Dimensions.get('window');

// 🧠 Tier 1: Memory Cache
const AUTHOR_MEMORY_CACHE = {};
const AUTHOR_POSTS_MEMORY_CACHE = {};

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

export default function AuthorPage() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";

    // ⚡️ Initialize MMKV Hook
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

    const scrollRef = useRef(null);
    const playerCardRef = useRef(null);

    // ⚡️ REANIMATED SHARED VALUES
    const pulseAnim = useSharedValue(1);
    const rotationAnim = useSharedValue(0);
    const skeletonFade = useSharedValue(0.3);

    // --- 🎨 Unified Theme Color Logic (Top Level) ---
    const auraRank = author?.previousRank || 0;
    const aura = getAuraTier(auraRank);
    const equippedGlow = author?.inventory?.find(i => i.category === 'GLOW' && i.isEquipped);
    const activeGlowColor = equippedGlow?.visualConfig?.primaryColor || null;
    const themeColor = activeGlowColor || aura.color;

    // ⚡️ REANIMATED ANIMATION TRIGGERS
    useEffect(() => {
        pulseAnim.value = withRepeat(
            withSequence(
                withTiming(1.1, { duration: 2000 }),
                withTiming(1, { duration: 2000 })
            ),
            -1,
            true
        );

        rotationAnim.value = withRepeat(
            withTiming(1, { duration: 20000, easing: Easing.linear }),
            -1,
            false
        );

        skeletonFade.value = withRepeat(
            withSequence(
                withTiming(0.7, { duration: 800 }),
                withTiming(0.3, { duration: 800 })
            ),
            -1,
            true
        );
    }, []);

    // ⚡️ REANIMATED ANIMATED STYLES
    const scanAnimatedStyle = useAnimatedStyle(() => {
        const rotate = interpolate(rotationAnim.value, [0, 1], [0, 360]);
        return {
            transform: [{ rotate: `${rotate}deg` }],
            borderColor: `${themeColor}40`
        };
    });

    const auraPulseStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: pulseAnim.value }],
            backgroundColor: themeColor
        };
    });

    const skeletonAnimatedStyle = useAnimatedStyle(() => {
        return {
            opacity: skeletonFade.value
        };
    });

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener("doScrollToTop", () => {
            scrollRef.current?.scrollToOffset({ offset: 0, animated: true });
        });
        return () => sub.remove();
    }, []);

    // ⚡️ Synchronous MMKV Save
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
            setTimeout(() => setIsInitialMount(false), 800);
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

    // ⚡️ Synchronous Cache Initialization
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

    const AuthorSkeleton = useCallback(() => (
        <View className="px-4 pt-20 pb-6 opacity-40">
            <View className="p-6 bg-gray-100 dark:bg-[#111] border border-gray-200 dark:border-gray-800 rounded-[40px] items-center">
                <Animated.View style={[skeletonAnimatedStyle]} className="w-32 h-32 bg-gray-300 dark:bg-gray-800 rounded-full mb-6" />
                <Animated.View style={[skeletonAnimatedStyle]} className="w-48 h-8 bg-gray-300 dark:bg-gray-800 rounded-lg mb-4" />
            </View>
        </View>
    ), [skeletonAnimatedStyle]);

    const renderItem = useCallback(({ item }) => (
        <View className="px-3">
            <PostCard 
                post={item} 
                authorData={item.authorData}
                clanData={item.clanData}  
                isFeed 
            />
        </View>
    ), [author]);

    const ListHeader = useCallback(() => {
        if (!author && isOffline) return <AuthorSkeleton />;
        if (!author) return null;

        const count = totalPosts;
        const rankTitle = count > 200 ? "Master_Writer" : count > 150 ? "Elite_Writer" : count > 100 ? "Senior_Writer" : count > 50 ? "Novice_Writer" : count > 25 ? "Senior_Researcher" : "Novice_Researcher";
        const rankIcon = count > 200 ? "👑" : count > 150 ? "💎" : count > 100 ? "🔥" : count > 50 ? "⚔️" : count > 25 ? "📜" : "🛡️";
        const nextMilestone = count > 200 ? 500 : count > 150 ? 200 : count > 100 ? 150 : count > 50 ? 100 : count > 25 ? 50 : 25;
        const progress = Math.min((count / nextMilestone) * 100, 100);

        const favoriteCharacter = author?.preferences?.favCharacter || "NONE_SET";

        const equippedBg = author.inventory?.find(i => i.category === 'BACKGROUND' && i.isEquipped);
        const bgVisual = equippedBg?.visualConfig || {};

        const equippedBorder = author.inventory?.find(i => i.category === 'BORDER' && i.isEquipped);
        const borderVisual = equippedBorder?.visualConfig || {};

        const equippedWatermark = author.inventory?.find(i => i.category === 'WATERMARK' && i.isEquipped);
        const watermarkVisual = equippedWatermark?.visualConfig || {};

        const SpecialWatermark = () => {
            if (!equippedWatermark) return null;
            const iconSize = watermarkVisual.size || 220;
            const iconColor = watermarkVisual.color || (isDark ? 'white' : 'black');
            return (
                <View className="absolute" style={{ bottom: -20, right: -20, opacity: 0.7, transform: [{ rotate: watermarkVisual.rotation || '-15deg' }] }} pointerEvents="none">
                    {watermarkVisual.svgCode ? (
                        <SvgXml xml={watermarkVisual.svgCode.replace(/currentColor/g, iconColor)} width={iconSize} height={iconSize} />
                    ) : (
                        <MaterialCommunityIcons name={watermarkVisual.icon || 'fountain-pen-tip'} size={iconSize} color={iconColor} />
                    )}
                </View>
            );
        };

        const HeaderCard = (
            <View className="relative p-6 bg-white dark:bg-[#0a0a0a] shadow-2xl rounded-[25px] overflow-hidden">
                
                {/* ⚡️ Top Right Container: Card Button & Streak */}
                <View className="absolute top-5 right-5 z-50 items-end gap-2">
                    <TouchableOpacity
                        onPress={() => setCardPreviewVisible(true)}
                        activeOpacity={0.7}
                        className="bg-gray-100/80 dark:bg-white/10 p-2 rounded-2xl border border-gray-200/50 dark:border-white/10"
                    >
                        <Ionicons name="card-outline" size={20} color={isDark ? "white" : "black"} />
                    </TouchableOpacity>
                    
                    {/* ⚡️ Streak Moved to Top Right below Card */}
                    <View className="flex-row items-center bg-orange-500/10 px-2 py-1 rounded-lg border border-orange-500/20">
                        <Ionicons name="flame" size={12} color="#f97316" />
                        <Text className="text-orange-500 font-black ml-1 text-[10px]">{author.lastStreak || "0"}</Text>
                    </View>
                </View>

                <View className="absolute -top-10 -right-10 w-60 h-60 opacity-10 rounded-full blur-3xl" style={{ backgroundColor: themeColor }} />
                <SpecialWatermark />

                {equippedBg && (
                    <View className="absolute inset-0">
                        <Svg height="100%" width="100%">
                            <Defs>
                                <LinearGradient id="authorCardGrad" x1="0%" y1="0%" x2="100%" >
                                    <Stop offset="0%" stopColor={bgVisual.primaryColor || themeColor} stopOpacity={0.15} />
                                    <Stop offset="100%" stopColor={bgVisual.secondaryColor || bgVisual.primaryColor || themeColor} stopOpacity={0.02} />
                                </LinearGradient>
                            </Defs>
                            <Rect x="0" y="0" width="100%" height="100%" fill="url(#authorCardGrad)" />
                        </Svg>
                    </View>
                )}

                <View className="flex-col items-center gap-6">
                    <View className="relative items-center justify-center">
                        <Animated.View
                            style={[
                                {
                                    position: 'absolute',
                                    width: 140,
                                    height: 140,
                                    borderRadius: 100,
                                    opacity: activeGlowColor ? 0.25 : 0.1,
                                },
                                auraPulseStyle
                            ]}
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
                        {/* ⚡️ Name & Peak Badge Layout */}
                        <View className="flex-row items-center justify-center gap-3 mb-3">
                            <Text style={{ textShadowColor: themeColor, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: (auraRank <= 2 || activeGlowColor) ? 10 : 0 }} className="text-3xl font-black italic tracking-tighter uppercase text-gray-900 dark:text-white text-center">
                                {author.username}
                            </Text>
                            {/* ⚡️ Peak Badge Injected Next to Name */}
                            {(author.peakLevel && author.peakLevel > 0) ? (
                                <View className="-mt-1">
                                    <PeakBadge level={author.peakLevel} size={28} />
                                </View>
                            ) : null}
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
                                <Text className="text-lg font-black" style={{ color: themeColor }}>+{author.weeklyAura || 0}</Text>
                            </View>
                            <View className="items-center">
                                <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Logs</Text>
                                <Text className="text-lg font-black dark:text-white">{totalPosts}</Text>
                            </View>
                            <View className="items-center">
                                <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rank</Text>
                                <Text className="text-lg font-black dark:text-white" style={{ color: themeColor }}>#{auraRank || '??'}</Text>
                            </View>
                        </View>

                        <View className="mt-8 w-full px-2">
                            <View className="flex-row justify-between items-end mb-2">
                                <View className="flex-row items-center gap-2">
                                    <Text className="text-2xl">{rankIcon}</Text>
                                    <View>
                                        <Text style={{ color: themeColor }} className="text-[8px] font-mono uppercase tracking-[0.2em] leading-none mb-1">Writer_Class</Text>
                                        <Text className="text-sm font-black uppercase tracking-tighter dark:text-white">{rankTitle}</Text>
                                    </View>
                                </View>
                                <Text className="text-[10px] font-mono font-bold text-gray-500 uppercase">EXP: {count} / {nextMilestone}</Text>
                            </View>
                            <View className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                <View style={{ width: `${progress}%`, backgroundColor: themeColor }} className="h-full shadow-lg shadow-blue-500" />
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
            {/* ⚡️ Swapped to LegendList */}
            <LegendList
                ref={scrollRef}
                data={posts}
                keyExtractor={(item) => item._id}
                renderItem={renderItem}
                ListHeaderComponent={ListHeader}
                
                // ⚡️ LegendList Performance Props
                estimatedItemSize={500}
                drawDistance={1000} // LegendList handles dynamic heights better with larger draw distances
                recycleItems={true}
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
                onRefresh={() => { setPage(1); fetchInitialData(); }}
                refreshing={refreshing}
                onScroll={(e) => { DeviceEventEmitter.emit("onScroll", e.nativeEvent.contentOffset.y); }}
                scrollEventThrottle={16}
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