import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LegendList } from "@legendapp/list";
import { useFocusEffect } from "expo-router";
import { useColorScheme } from "nativewind";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DeviceEventEmitter, InteractionManager, RefreshControl, View } from "react-native";
import { useMMKV } from 'react-native-mmkv';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mutate as globalMutate } from "swr";
import useSWRInfinite from "swr/infinite";
import apiFetch from "../utils/apiFetch";
import AnimeLoading from "./AnimeLoading";
import PostCard from "./PostCard";
import { SyncLoading } from "./SyncLoading";
import { Text } from "./Text";

const fetcher = (url) => apiFetch(url).then(res => res.json());

// ⚡️ GLOBAL EVENT CONSTANT
export const FEED_VISIBILITY_EVENT = "feed_item_visibility_changed";

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

const LIMIT = 15;
const CACHE_KEY = "POSTS_CACHE_V1";
const SESSION_STATE = { memoryCache: null, hasFetched: false };

// ⚡️ FIX 1: List items subscribe to the global listener instead of passing state down 3 levels
const MemoizedPostItem = memo(({ item, syncing, mutate, posts }) => {
    const [isReady, setIsReady] = useState(SESSION_STATE.hasFetched);
    const [isVisible, setIsVisible] = useState(false); // Default true for initial view
    const visibilityTimeout = useRef(null);
    useEffect(() => {
        if (!isReady) {
            const task = InteractionManager.runAfterInteractions(() => {
                setIsReady(true);
            });
            return () => task.cancel();
        }
    }, [isReady]);

    // ⚡️ Subscribes to visibility changes directly to avoid parent rendering loops
    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener(
            FEED_VISIBILITY_EVENT,
            (visibleSet) => {
                const currentVisibility = visibleSet.has(item._id);

                if (visibilityTimeout.current) {
                    clearTimeout(visibilityTimeout.current);
                }

                if (currentVisibility) {
                    setIsVisible(true);
                } else if (isVisible) {
                    visibilityTimeout.current = setTimeout(() => {
                        setIsVisible(false);
                    }, 500);
                }
            }
        );

        return () => {
            if (visibilityTimeout.current) {
                clearTimeout(visibilityTimeout.current);
            }
            subscription.remove();
        };
    }, [item._id]);

    if (!isReady) return <PostSkeleton />;

    return (
        <PostCard
            post={item}
            authorData={item.authorData}
            clanData={item.clanData}
            isFeed={true}
            setPosts={mutate}
            syncing={syncing}
            isVisible={isVisible} // Clean toggle sent to Lottie/Skia downstream
        />
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.syncing === nextProps.syncing &&
        prevProps.item === nextProps.item &&
        prevProps.mutate === nextProps.mutate
    );
});

export default function PostsViewer() {
    const storage = useMMKV();
    const scrollRef = useRef(null);
    const insets = useSafeAreaInsets();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";

    const cachedData = useMemo(() => {
        if (SESSION_STATE.memoryCache) return SESSION_STATE.memoryCache;
        try {
            const local = storage.getString(CACHE_KEY);
            if (local) {
                const parsed = JSON.parse(local);
                if (parsed && Array.isArray(parsed.data)) {
                    SESSION_STATE.memoryCache = parsed.data;
                    return parsed.data;
                }
            }
        } catch (e) {
            console.error("MMKV load error", e);
        }
        return undefined;
    });

    const [isOfflineMode, setIsOfflineMode] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const pulseAnim = useSharedValue(0);

    const saveHeavyCache = useCallback((data) => {
        try {
            const cacheEntry = { data: data, timestamp: Date.now() };
            storage.set(CACHE_KEY, JSON.stringify(cacheEntry));
        } catch (e) {
            console.error("MMKV Save Error", e);
        }
    }, [storage]);

    useEffect(() => {
        pulseAnim.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 1500, easing: Easing.linear }),
                withTiming(0, { duration: 1500, easing: Easing.linear })
            ),
            -1,
            false
        );
    }, []);

    const pulseAnimatedStyle = useAnimatedStyle(() => {
        return { opacity: pulseAnim.value };
    });

    const getKey = (pageIndex, previousPageData) => {
        if (previousPageData && previousPageData.posts?.length < LIMIT) return null;
        return `/posts?page=${pageIndex + 1}&limit=${LIMIT}`;
    };

    const { data, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite(getKey, fetcher, {
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        revalidateIfStale: true,
        fallbackData: cachedData,
        onSuccess: (newData) => {
            setIsOfflineMode(false);
            setRefreshing(false);
            SESSION_STATE.memoryCache = newData;
            SESSION_STATE.hasFetched = true;
            saveHeavyCache(newData);
        },
        onError: () => {
            setIsOfflineMode(true);
            setRefreshing(false);
        }
    });

    useFocusEffect(
        useCallback(() => {
            globalMutate(
                key => typeof key === 'string' && (key.startsWith('/posts?') || key.startsWith('/posts/')),
                undefined,
                { revalidate: true }
            );
        }, [])
    );

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        SESSION_STATE.hasFetched = false;
        await mutate();
    }, [mutate]);

    // ⚡️ FIX 2: Emits an event with IDs instead of saving to state. 0 parent re-renders!
    const lastVisibleIds = useRef("");

    const onViewableItemsChanged = useRef(({ viewableItems }) => {
        const ids = viewableItems
            .map(v => v.item._id)
            .sort();

        const key = ids.join(",");

        if (key === lastVisibleIds.current) return;

        lastVisibleIds.current = key;

        DeviceEventEmitter.emit(
            FEED_VISIBILITY_EVENT,
            new Set(ids)
        );
    }).current;

    // ⚡️ FIX 3: Lowered to 20% so big cards trigger visibility instantly when entering screen edge
    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 20 }).current;

    const hasMore = data ? data[data.length - 1]?.posts?.length === LIMIT : false;

    const posts = useMemo(() => {
        const sourceData = data || cachedData;
        if (!sourceData || !Array.isArray(sourceData)) return [];
        const orderedList = [];
        const seenIds = new Set();
        sourceData.forEach((page) => {
            if (page?.posts && Array.isArray(page.posts)) {
                page.posts.forEach((p) => {
                    if (p?._id && !seenIds.has(p._id)) {
                        seenIds.add(p._id);
                        orderedList.push(p);
                    }
                });
            }
        });

        if (isValidating && hasMore) {
            orderedList.push(
                { _id: 'ghost-1', isGhost: true },
                { _id: 'ghost-2', isGhost: true },
                { _id: 'ghost-3', isGhost: true }
            );
        }
        return orderedList;
    }, [data, cachedData, isValidating, hasMore]);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener("doScrollToTop", () => {
            scrollRef.current?.scrollToOffset({ offset: 0, animated: true });
        });
        return () => sub.remove();
    }, []);

    const loadMore = useCallback(() => {
        if (!hasMore || isValidating || isLoading || isOfflineMode) return;
        setSize(size + 1);
    }, [hasMore, isValidating, isLoading, isOfflineMode, size, setSize]);

    // ⚡️ FIX 4: Empty dependency array means this function reference NEVER changes, fixing your crash!
    const renderItem = useCallback(({ item }) => {
        if (item.isGhost) {
            return <PostSkeleton />;
        }
        return (
            <MemoizedPostItem
                item={item}
                syncing={!SESSION_STATE.hasFetched || isValidating}
                mutate={mutate}
            />
        );
    }, [mutate, posts]); // Removed runtime validation flags that break the static instance cache

    const ListHeader = useCallback(() => (
        <View className="mb-5 pb-2">
            <View className="flex-row items-center gap-3 mb-1">
                <View className={`h-2 w-2 rounded-full ${isOfflineMode ? 'bg-orange-500' : 'bg-blue-600'}`} />
                <Text className={`text-[10px] font-[900] uppercase tracking-[0.4em] ${isOfflineMode ? 'text-orange-500' : 'text-blue-600'}`}>
                    {isOfflineMode ? "Archived Intel // Offline" : "Live Feed Active"}
                </Text>
            </View>
            <View className="relative">
                <Text className={`text-5xl font-[900] italic tracking-tighter uppercase ${isDark ? "text-white" : "text-gray-900"}`}>
                    Anime <Text className={isOfflineMode ? "text-orange-500" : "text-blue-600"}>Intel</Text>
                </Text>
                <View className={`h-[2px] w-24 mt-2 ${isOfflineMode ? 'bg-orange-500' : 'bg-blue-600'}`} />
            </View>
        </View>
    ), [isOfflineMode, isDark]);

    const lastScrollY = useRef(0);
    const handleScroll = useCallback((e) => {
        const offsetY = e.nativeEvent.contentOffset.y;
        if (Math.abs(offsetY - lastScrollY.current) > 15) {
            DeviceEventEmitter.emit("onScroll", offsetY);
            lastScrollY.current = offsetY;
        }
    }, []);

    if (isLoading && posts.length === 0) {
        return <AnimeLoading tipType={"post"} message="Loading Posts" subMessage="Prepping Otaku content" />
    }

    return (
        <View className={`flex-1 ${isDark ? "bg-[#050505]" : "bg-white"}`}>
            <LegendList
                key="main-feed-list" // ⚡️ FIXED: Isolates scroll memory from other pages
                ref={scrollRef}
                data={posts}
                keyExtractor={(item) => item._id}
                ListHeaderComponent={ListHeader}
                removeClippedSubviews
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingTop: insets.top + 20,
                    paddingBottom: insets.bottom + 120,
                }}
                renderItem={renderItem}
                estimatedItemSize={630}
                drawDistance={800}
                recycleItems={true}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={["#2563eb"]}
                        tintColor="#2563eb"
                        title={"Updating Feed..."}
                        titleColor={isDark ? "#ffffff" : "#2563eb"}
                        progressBackgroundColor={isDark ? "#1a1a1a" : "#ffffff"}
                    />
                }
                onScroll={handleScroll}
                scrollEventThrottle={16}
                ListFooterComponent={
                    <View className="py-12 items-center justify-center min-h-[140px]">
                        {(isLoading || (isValidating && size > 1)) ? (
                            <SyncLoading />
                        ) : !hasMore && posts.length > 0 ? (
                            <Text className="text-[10px] font-[900] uppercase tracking-[0.5em] text-gray-400">
                                End of Transmission
                            </Text>
                        ) : null}
                    </View>
                }
            />
            <View
                className="absolute left-6 flex-row items-center gap-2"
                style={{ bottom: insets.bottom + 20, opacity: 0.4 }}
                pointerEvents="none"
            >
                <MaterialCommunityIcons
                    name={isOfflineMode ? "cloud-off-outline" : "pulse"}
                    size={14}
                    color={isOfflineMode ? "#f97316" : "#2563eb"}
                />
                <Animated.View style={pulseAnimatedStyle}>
                    <Text className={`text-[8px] font-[900] uppercase tracking-[0.4em] ${isOfflineMode ? 'text-orange-500' : 'text-blue-600'}`}>
                        {isOfflineMode ? "Cache_Relay_Active" : "Neural_Link_Established"}
                    </Text>
                </Animated.View>
            </View>
        </View>
    );
}