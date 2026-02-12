import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "nativewind";
import { useEffect, useRef, useState } from "react";
import {
    Animated,
    DeviceEventEmitter,
    Dimensions,
    Easing,
    FlatList,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppBanner from '../../../components/AppBanner';
import PostCard from "../../../components/PostCard";
import { SyncLoading } from "../../../components/SyncLoading";
import { Text } from "../../../components/Text";
import apiFetch from "../../../utils/apiFetch";

const { width } = Dimensions.get('window');
const LIMIT = 10;

// 🧠 Tier 1: Memory Cache (Lives outside the component)
const CATEGORY_MEMORY_CACHE = {};

export default function CategoryPage({ forcedId }) {
    const id = forcedId;
    const insets = useSafeAreaInsets();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";

    const pulseAnim = useRef(new Animated.Value(0)).current;

    const categoryName = id
        ? id.includes("-")
            ? id.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("/")
            : id.charAt(0).toUpperCase() + id.slice(1).toLowerCase()
        : "";

    const CACHE_KEY = `CATEGORY_CACHE_${categoryName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;

    // Initialize state with Memory Cache if it exists for instant load
    const [posts, setPosts] = useState(CATEGORY_MEMORY_CACHE[CACHE_KEY] || []);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [isOfflineMode, setIsOfflineMode] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 0, duration: 1500, easing: Easing.linear, useNativeDriver: true })
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [pulseAnim]);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener("doScrollToTop", () => {
            scrollRef.current?.scrollToOffset({ offset: 0, animated: true });
        });
        return () => sub.remove();
    }, []);

    // 🛡️ Save to AsyncStorage with timestamp for your Janitor
    const saveHeavyCache = async (key, data) => {
        try {
            const cacheEntry = {
                data: data,
                timestamp: Date.now(),
            };
            await AsyncStorage.setItem(key, JSON.stringify(cacheEntry));
        } catch (e) {
            console.error("Cache Save Error", e);
        }
    };

    const fetchPosts = async (pageNum = 1, isRefresh = false) => {
        if (loading || (!hasMore && !isRefresh)) return;

        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const res = await apiFetch(`/posts?category=${categoryName}&page=${pageNum}&limit=${LIMIT}`);
            const data = await res.json();
            const newPosts = data.posts || [];

            setPosts((prev) => {
                const updatedList = isRefresh
                    ? newPosts
                    : Array.from(new Map([...prev, ...newPosts].map(p => [p._id, p])).values());

                // 💾 Update Memory Cache (Tier 1)
                CATEGORY_MEMORY_CACHE[CACHE_KEY] = updatedList;

                // 💾 Update AsyncStorage (Tier 2)
                if (updatedList.length > 0) {
                    saveHeavyCache(CACHE_KEY, updatedList);
                }
                return updatedList;
            });

            setHasMore(newPosts.length === LIMIT);
            setPage(pageNum + 1);
            setIsOfflineMode(false);
        } catch (e) {
            console.error("Category Fetch Error:", e);
            setIsOfflineMode(true);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // ⚡ HYBRID INIT: Memory -> Storage -> API
    useEffect(() => {
        const init = async () => {
            // 1. Check Memory first (Already handled in useState, but ensures sync)
            if (CATEGORY_MEMORY_CACHE[CACHE_KEY]) {
                setPosts(CATEGORY_MEMORY_CACHE[CACHE_KEY]);
                setPage(2);
                fetchPosts(1, true); // Revalidate in background
                return;
            }

            try {
                // 2. Check AsyncStorage
                const cached = await AsyncStorage.getItem(CACHE_KEY);
                if (cached) {
                    const parsedEntry = JSON.parse(cached);
                    const cachedData = parsedEntry?.data || parsedEntry;

                    if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
                        CATEGORY_MEMORY_CACHE[CACHE_KEY] = cachedData; // Fill memory
                        setPosts(cachedData);
                        setPage(2);
                        fetchPosts(1, true); // Revalidate
                        return;
                    }
                }

                // 3. Fallback to API
                fetchPosts(1, true);
            } catch (e) {
                fetchPosts(1, true);
            }
        };
        init();
    }, [id]);

    const renderItem = ({ item, index }) => {
        const showAd = (index + 1) % 4 === 0;
        return (
            <View className="px-4">
                <PostCard post={item} isFeed />
                {showAd && <View className="mb-3 mt-3 w-full p-6 border border-dashed border-gray-300 dark:border-gray-800 rounded-[32px] bg-gray-50/50 dark:bg-white/5 items-center justify-center">
                    <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] italic text-center">Sponsored Transmission</Text>
                    <AppBanner size="MEDIUM_RECTANGLE" />
                </View>}
            </View>
        );
    };

    const ListHeader = () => (
        <View className="px-5 mb-10 pb-6 border-b-2 border-gray-100 dark:border-gray-800">
            <View className="flex-row items-center gap-3 mb-2">
                <View className={`h-2 w-2 rounded-full ${isOfflineMode ? 'bg-orange-500' : 'bg-blue-600'}`} />
                <Text className={`text-[10px] font-[900] uppercase tracking-[0.4em] ${isOfflineMode ? 'text-orange-500' : 'text-blue-600'}`}>
                    {isOfflineMode ? "Archived Sector // Offline" : "Archive Sector Online"}
                </Text>
            </View>
            <View className="relative">
                <Text className={`text-4xl font-[900] italic tracking-tighter uppercase ${isDark ? "text-white" : "text-gray-900"}`}>
                    Folder: <Text className={isOfflineMode ? "text-orange-500" : "text-blue-600"}>{categoryName}</Text>
                </Text>
                <View className={`absolute -bottom-2 left-0 h-[2px] w-20 ${isOfflineMode ? 'bg-orange-500' : 'bg-blue-600'}`} />
            </View>
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: isDark ? "#050505" : "#ffffff" }}>
            <View
                pointerEvents="none"
                className="absolute -top-20 -right-20 rounded-full opacity-[0.08]"
                style={{ width: width * 0.7, height: width * 0.7, backgroundColor: isOfflineMode ? '#f97316' : (isDark ? '#2563eb' : '#3b82f6') }}
            />

            <FlatList
                ref={scrollRef}
                data={posts}
                keyExtractor={(item) => item._id}
                renderItem={renderItem}
                ListHeaderComponent={ListHeader}
                contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 }}
                ListFooterComponent={() => (
                    <View className="py-12 items-center justify-center min-h-[140px]">
                        {loading && !refreshing ? (
                            <SyncLoading />
                        ) : !hasMore && posts.length > 0 ? (
                            <View className="items-center">
                                <View className="h-[1px] w-12 bg-gray-200 dark:bg-gray-800 mb-4" />
                                <Text className="text-[10px] font-[900] uppercase tracking-[0.5em] text-gray-400">End of {categoryName} Archive</Text>
                            </View>
                        ) : null}
                    </View>
                )}
                onEndReached={() => !isOfflineMode && fetchPosts(page)}
                onEndReachedThreshold={0.5}
                onScroll={(e) => DeviceEventEmitter.emit("onScroll", e.nativeEvent.contentOffset.y)}
                scrollEventThrottle={16}
                removeClippedSubviews={true}
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                windowSize={5}
            />

            <View
                className="absolute left-6 flex-row items-center gap-2"
                style={{ bottom: insets.bottom + 20, opacity: 0.6 }}
                pointerEvents="none"
            >
                <MaterialCommunityIcons name={isOfflineMode ? "cloud-off-outline" : "pulse"} size={14} color={isOfflineMode ? "#f97316" : "#2563eb"} />
                <Animated.Text style={{ opacity: pulseAnim }} className={`text-[8px] font-[900] uppercase tracking-[0.4em] ${isOfflineMode ? 'text-orange-500' : 'text-blue-600'}`}>
                    {isOfflineMode ? "Cache_Relay_Active" : "Neural_Link_Established"}
                </Animated.Text>
            </View>
        </View>
    );
}
