import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    DeviceEventEmitter,
    Dimensions,
    Easing,
    FlatList,
    RefreshControl,
    View,
    AppState // 👈 Added for foreground detection
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import useSWRInfinite from "swr/infinite";
import AppBanner from '../../../components/AppBanner';
import PostCard from "../../../components/PostCard";
import { SyncLoading } from "../../../components/SyncLoading";
import { Text } from "../../../components/Text";
import apiFetch from "../../../utils/apiFetch";

const { width } = Dimensions.get('window');
const LIMIT = 10;

const fetcher = (url) => apiFetch(url).then(res => res.json());

// 🧠 Tier 1: Memory Cache
const CATEGORY_MEMORY_CACHE = {};

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

export default function CategoryPage({ forcedId }) {
    const id = forcedId;
    const insets = useSafeAreaInsets();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";

    const pulseAnim = useRef(new Animated.Value(0)).current;
    const appState = useRef(AppState.currentState); // 👈 Track current app state

    const categoryName = id
        ? id.includes("-")
            ? id.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("/")
            : id.charAt(0).toUpperCase() + id.slice(1).toLowerCase()
        : "";

    const CACHE_KEY = `CATEGORY_CACHE_${categoryName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;

    const [ready, setReady] = useState(false);
    const [cachedData, setCachedData] = useState(CATEGORY_MEMORY_CACHE[CACHE_KEY]);
    const [isOfflineMode, setIsOfflineMode] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const scrollRef = useRef(null);

    // Initial Cache Hydration
    useEffect(() => {
        const prepare = async () => {
            try {
                if (!CATEGORY_MEMORY_CACHE[CACHE_KEY]) {
                    const local = await AsyncStorage.getItem(CACHE_KEY);
                    if (local) {
                        const parsed = JSON.parse(local);
                        if (Array.isArray(parsed.data)) {
                            setCachedData([{ posts: parsed.data }]); // Wrap for SWR format compatibility
                            CATEGORY_MEMORY_CACHE[CACHE_KEY] = parsed.data;
                        }
                    }
                }
            } catch (e) {
                console.error("Cache load error", e);
            }
            setReady(true);
        };
        prepare();
    }, [id]);

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

    const getKey = (pageIndex, previousPageData) => {
        if (!ready) return null;
        if (previousPageData && previousPageData.posts?.length < LIMIT) return null;
        return `/posts?category=${categoryName}&page=${pageIndex + 1}&limit=${LIMIT}`;
    };

    const { data, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite(getKey, fetcher, {
        refreshInterval: 0,
        revalidateOnFocus: true, // 👈 Set to true for internal consistency
        revalidateOnReconnect: true,
        revalidateIfStale: true,
        revalidateOnMount: !CATEGORY_MEMORY_CACHE[CACHE_KEY], 
        dedupingInterval: 10000,
        fallbackData: cachedData,
        onSuccess: (newData) => {
            setIsOfflineMode(false);
            setRefreshing(false);
            const flatData = newData.flatMap(page => page.posts || []);
            CATEGORY_MEMORY_CACHE[CACHE_KEY] = flatData;
            saveHeavyCache(CACHE_KEY, flatData);
        },
        onError: () => {
            setIsOfflineMode(true);
            setRefreshing(false);
        }
    });

    // 🚀 NEW: Foreground App Listener
    useEffect(() => {
        const subscription = AppState.addEventListener("change", nextAppState => {
            if (
                appState.current.match(/inactive|background/) && 
                nextAppState === "active"
            ) {
                console.log(`Re-linking Neural Archives for: ${categoryName}`);
                mutate(); // Refresh the category intel
            }
            appState.current = nextAppState;
        });

        return () => {
            subscription.remove();
        };
    }, [mutate, categoryName]);

    const posts = useMemo(() => {
        const sourceData = data || cachedData;
        if (!sourceData) return [];
        const postMap = new Map();
        sourceData.forEach(page => {
            if (page?.posts) {
                page.posts.forEach(p => p?._id && postMap.set(p._id, p));
            }
        });
        return Array.from(postMap.values());
    }, [data, cachedData]);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await mutate();
    }, [mutate]);

    const loadMore = () => {
        if (isLoading || isValidating || isOfflineMode) return;
        setSize(size + 1);
    };

    const hasMore = data ? data[data.length - 1]?.posts?.length === LIMIT : false;

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener("doScrollToTop", () => {
            scrollRef.current?.scrollToOffset({ offset: 0, animated: true });
        });
        return () => sub.remove();
    }, []);

    const renderItem = ({ item, index }) => {
        const showAd = (index + 1) % 4 === 0;
        return (
            <View className="px-4">
                <PostCard post={item} isFeed posts={posts} setPosts={mutate} />
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
                
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={["#2563eb"]}
                        tintColor="#2563eb"
                        title={"Fetching Archives..."}
                        titleColor={isDark ? "#ffffff" : "#2563eb"}
                        progressBackgroundColor={isDark ? "#1a1a1a" : "#ffffff"}
                    />
                }

                ListFooterComponent={() => (
                    <View className="py-12 items-center justify-center min-h-[140px]">
                        {(isLoading || (isValidating && size > 1)) && !refreshing ? (
                            <SyncLoading />
                        ) : !hasMore && posts.length > 0 ? (
                            <View className="items-center">
                                <View className="h-[1px] w-12 bg-gray-200 dark:bg-gray-800 mb-4" />
                                <Text className="text-[10px] font-[900] uppercase tracking-[0.5em] text-gray-400">End of {categoryName} Archive</Text>
                            </View>
                        ) : null}
                    </View>
                )}
                onEndReached={loadMore}
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
