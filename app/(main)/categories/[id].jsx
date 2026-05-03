import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LegendList } from "@legendapp/list";
import { useFocusEffect, useLocalSearchParams } from "expo-router"; // ⚡️ ADDED: useFocusEffect
import { useColorScheme } from "nativewind";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    DeviceEventEmitter,
    Dimensions,
    InteractionManager,
    RefreshControl,
    View
} from "react-native";
import { useMMKV } from 'react-native-mmkv';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mutate as globalMutate } from "swr"; // ⚡️ ADDED: globalMutate for instant hydration
import useSWRInfinite from "swr/infinite";

import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';

import { ScrollViewObserver } from 'react-native-use-in-view';
import AnimeLoading from "../../../components/AnimeLoading";
import PostCard from "../../../components/PostCard";
import { SyncLoading } from "../../../components/SyncLoading";
import { Text } from "../../../components/Text";
import apiFetch from "../../../utils/apiFetch";

const { width } = Dimensions.get('window');
const LIMIT = 10;

const fetcher = (url) => apiFetch(url).then(res => res.json());

const PostSkeleton = memo(() => {
    const isDark = useColorScheme() === "dark";
    return (
        <View className={`mb-8 p-4 rounded-[32px] border ${isDark ? "bg-[#0d1117] border-gray-800" : "bg-white border-gray-100"} opacity-40`}>
            <View className="flex-row items-center gap-4 mb-6">
                <View className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-800" />
                <View className="flex-1 gap-2">
                    <View className="w-32 h-3 bg-gray-200 dark:bg-gray-800 rounded-md" />
                    <View className="w-20 h-2 bg-gray-100 dark:bg-gray-900 rounded-md" />
                </View>
            </View>
            <View className="w-full h-6 bg-gray-200 dark:bg-gray-800 rounded-md mb-3" />
            <View className="w-3/4 h-6 bg-gray-200 dark:bg-gray-800 rounded-md mb-6" />
            <View className="w-full h-[380px] bg-gray-100 dark:bg-gray-900 rounded-2xl mb-6" />
            <View className="flex-row justify-between items-center border-t border-gray-100 dark:border-gray-800 pt-4">
                <View className="flex-row gap-6">
                    <View className="w-12 h-4 bg-gray-100 dark:bg-gray-800 rounded-full" />
                    <View className="w-12 h-4 bg-gray-100 dark:bg-gray-800 rounded-full" />
                </View>
                <View className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full" />
            </View>
        </View>
    );
});

const CATEGORY_MEMORY_CACHE = {};
const CATEGORIES_SYNCED_THIS_SESSION = new Set();

const MemoizedPostItem = memo(({ item, isVisible, mutate, posts }) => {
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        setIsReady(false);
        const task = InteractionManager.runAfterInteractions(() => {
            setIsReady(true);
        });
        return () => task.cancel();
    }, [item._id]);

    if (!isReady) return <View className="px-3"><PostSkeleton /></View>;

    return (
        <View className="px-3">
            <PostCard
                post={item}
                authorData={item.authorData}
                clanData={item.clanData}
                isFeed
                posts={posts}
                setPosts={mutate}
                isVisible={isVisible}
            />
        </View>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.isVisible === nextProps.isVisible &&
        prevProps.item === nextProps.item
    );
});

export default function CategoryPage() {
    const storage = useMMKV();
    const { id } = useLocalSearchParams();

    const insets = useSafeAreaInsets();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";

    const pulseAnim = useSharedValue(0);

    const categoryName = useMemo(() => {
        if (!id) return "";
        return id.includes("-")
            ? id.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("/")
            : id.charAt(0).toUpperCase() + id.slice(1).toLowerCase();
    }, [id]);

    const CACHE_KEY = `CATEGORY_CACHE_${categoryName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;

    const [ready, setReady] = useState(false);
    const [cachedData, setCachedData] = useState(() => {
        if (CATEGORY_MEMORY_CACHE[CACHE_KEY]) return [{ posts: CATEGORY_MEMORY_CACHE[CACHE_KEY] }];
        try {
            const local = storage.getString(CACHE_KEY);
            if (local) {
                const parsed = JSON.parse(local);
                if (parsed?.data && Array.isArray(parsed.data)) {
                    CATEGORY_MEMORY_CACHE[CACHE_KEY] = parsed.data;
                    return [{ posts: parsed.data }];
                }
            }
        } catch (e) { console.error(e); }
        return null;
    });

    const [isOfflineMode, setIsOfflineMode] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [visibleIds, setVisibleIds] = useState(new Set());
    const scrollRef = useRef(null);

    const saveHeavyCache = useCallback((key, data) => {
        try {
            const cacheEntry = { data: data, timestamp: Date.now() };
            storage.set(key, JSON.stringify(cacheEntry));
        } catch (e) { console.error("Cache Save Error", e); }
    }, [storage]);

    useEffect(() => {
        InteractionManager.runAfterInteractions(() => {
            setReady(true);
        });

        pulseAnim.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
                withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );
    }, []);

    const pulseStyle = useAnimatedStyle(() => ({ opacity: pulseAnim.value }));

    const getKey = (pageIndex, previousPageData) => {
        if (!ready || !id) return null;
        if (previousPageData && previousPageData.posts?.length < LIMIT) return null;
        return `/posts?category=${categoryName}&page=${pageIndex + 1}&limit=${LIMIT}`;
    };

    const { data, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite(getKey, fetcher, {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        revalidateIfStale: false,
        revalidateOnMount: !CATEGORIES_SYNCED_THIS_SESSION.has(CACHE_KEY),
        dedupingInterval: 10000,
        fallbackData: cachedData || undefined,
        onSuccess: (newData) => {
            setIsOfflineMode(false);
            setRefreshing(false);
            const flatData = newData.flatMap(page => page.posts || []);
            CATEGORY_MEMORY_CACHE[CACHE_KEY] = flatData;
            CATEGORIES_SYNCED_THIS_SESSION.add(CACHE_KEY);
            saveHeavyCache(CACHE_KEY, flatData);
        },
        onError: () => {
            setIsOfflineMode(true);
            setRefreshing(false);
        }
    });

    // ⚡️ INSTANT FOCUS SYNC: Solves the "likes not updating" bug
    useFocusEffect(
        useCallback(() => {
            // Silently tells SWR to re-verify the active posts in the background
            globalMutate(
                key => typeof key === 'string' && key.startsWith('/posts/'),
                undefined,
                { revalidate: true }
            );
        }, [])
    );

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

    const loadMore = useCallback(() => {
        if (isLoading || isValidating || isOfflineMode) return;
        setSize(size + 1);
    }, [isLoading, isValidating, isOfflineMode, size, setSize]);

    const hasMore = data ? data[data.length - 1]?.posts?.length === LIMIT : false;

    const onViewableItemsChanged = useRef(({ viewableItems }) => {
        const newVisible = new Set(viewableItems.map(v => v.item._id));
        setVisibleIds(newVisible);
    }).current;

    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

    const lastScrollY = useRef(0);
    const handleScroll = useCallback((e) => {
        const offsetY = e.nativeEvent.contentOffset.y;
        if (Math.abs(offsetY - lastScrollY.current) > 20) {
            DeviceEventEmitter.emit("onScroll", offsetY);
            lastScrollY.current = offsetY;
        }
    }, []);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener("doScrollToTop", () => {
            scrollRef.current?.scrollToOffset({ offset: 0, animated: true });
        });
        return () => sub.remove();
    }, []);

    const renderItem = useCallback(({ item }) => (
        <MemoizedPostItem
            item={item}
            isVisible={true} // ⚡️ FIXED: Forcing true guarantees SWR key never goes null so it can receive likes
            mutate={mutate}
            posts={posts}
        />
    ), [posts, mutate]);

    const ListHeader = useMemo(() => (
        <View className="px-5 mb-5 pb-6 border-b-2 border-gray-100 dark:border-gray-800">
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
    ), [isOfflineMode, isDark, categoryName]);

    if (!id) {
        return (
            <View className={`flex-1 items-center justify-center ${isDark ? 'bg-[#050505]' : 'bg-white'}`}>
                <Text className="text-gray-500">No Category Selected</Text>
            </View>
        );
    }

    if (!ready || (isLoading && posts.length === 0)) {
        return <AnimeLoading tipType={"post"} message={`Decoding ${categoryName}`} subMessage="Accessing encrypted anime archives..." />
    }

    return (
        <View style={{ flex: 1, backgroundColor: isDark ? "#050505" : "#ffffff" }}>
            <View
                pointerEvents="none"
                className="absolute -top-20 -right-20 rounded-full opacity-[0.08]"
                style={{ width: width * 0.7, height: width * 0.7, backgroundColor: isOfflineMode ? '#f97316' : (isDark ? '#2563eb' : '#3b82f6') }}
            />
            <ScrollViewObserver>
                <LegendList
                    key={`category-list-${id}`} // ⚡️ FIXED: Isolates scroll memory per category
                    ref={scrollRef}
                    data={posts}
                    keyExtractor={(item) => item._id}
                    renderItem={renderItem}
                    removeClippedSubviews={true}
                    ListHeaderComponent={ListHeader}
                    estimatedItemSize={630}
                    recycleItems={true}
                    drawDistance={1000}
                    // ⚡️ FIXED: Removed recycleItems=true to stop weird SWR caching bugs and scroll jumping
                    onViewableItemsChanged={onViewableItemsChanged}
                    viewabilityConfig={viewabilityConfig}
                    contentContainerStyle={{
                        paddingTop: insets.top + 20,
                        paddingBottom: insets.bottom + 120
                    }}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            colors={["#2563eb"]}
                            tintColor="#2563eb"
                        />
                    }
                    ListFooterComponent={
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
                    }
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.5}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                />
            </ScrollViewObserver>
            <View
                className="absolute left-6 flex-row items-center gap-2"
                style={{ bottom: insets.bottom + 20, opacity: 0.6 }}
                pointerEvents="none"
            >
                <MaterialCommunityIcons name={isOfflineMode ? "cloud-off-outline" : "pulse"} size={14} color={isOfflineMode ? "#f97316" : "#2563eb"} />
                <Animated.Text
                    style={pulseStyle}
                    className={`text-[8px] font-[900] uppercase tracking-[0.4em] ${isOfflineMode ? 'text-orange-500' : 'text-blue-600'}`}
                >
                    {isOfflineMode ? "Cache_Relay_Active" : "Neural_Link_Established"}
                </Animated.Text>
            </View>
        </View>
    )
}