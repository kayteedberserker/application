import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    DeviceEventEmitter,
    RefreshControl,
    View
} from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from "react-native-reanimated";
import { LegendList } from "@legendapp/list"; 
import { useMMKV } from 'react-native-mmkv'; 
import { useSafeAreaInsets } from "react-native-safe-area-context";
import useSWRInfinite from "swr/infinite";
import apiFetch from "../utils/apiFetch";
import AnimeLoading from "./AnimeLoading";
import PostCard from "./PostCard";
import { SyncLoading } from "./SyncLoading";
import { Text } from "./Text";

const fetcher = (url) => apiFetch(url).then(res => res.json());

const LIMIT = 15;
const CACHE_KEY = "POSTS_CACHE_V1";

const SESSION_STATE = {
    memoryCache: null,
    hasFetched: false
};

export default function PostsViewer() {
    const storage = useMMKV(); 
    
    const scrollRef = useRef(null);
    const insets = useSafeAreaInsets();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";

    const [cachedData, setCachedData] = useState(() => {
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
            const cacheEntry = {
                data: data,
                timestamp: Date.now(),
            };
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
        return {
            opacity: pulseAnim.value
        };
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

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        SESSION_STATE.hasFetched = false;
        await mutate();
    }, [mutate]);

    const [visibleIds, setVisibleIds] = useState(new Set());

    const onViewableItemsChanged = useRef(({ viewableItems }) => {
        const newVisible = new Set(viewableItems.map(v => v.item._id));
        setVisibleIds(newVisible);
    }).current;

    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

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

        return orderedList;
    }, [data, cachedData]);

    const hasMore = data ? data[data.length - 1]?.posts?.length === LIMIT : false;

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

    const renderItem = useCallback(({ item }) => {
        return (
            <PostCard
                post={item}
                authorData={item.authorData} 
                clanData={item.clanData}
                isFeed
                posts={posts}
                setPosts={mutate}
                syncing={!SESSION_STATE.hasFetched || isValidating}
                isVisible={visibleIds.has(item._id)}
            />
        );
    }, [posts, visibleIds, isValidating, mutate]);

    const ListHeader = useCallback(() => (
        <View className="mb-10 pb-2">
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

    if (isLoading && posts.length === 0) {
        return <AnimeLoading tipType={"post"} message="Loading Posts" subMessage="Prepping Otaku content" />
    }

    return (
        <View className={`flex-1 ${isDark ? "bg-[#050505]" : "bg-white"}`}>
            <LegendList
                ref={scrollRef}
                data={posts}
                keyExtractor={(item) => item._id}
                ListHeaderComponent={ListHeader}
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingTop: insets.top + 20,
                    paddingBottom: insets.bottom + 120,
                }}
                renderItem={renderItem}
                estimatedItemSize={600} 
                drawDistance={2000} 
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
                onScroll={(e) => {
                    const offsetY = e.nativeEvent.contentOffset.y;
                    DeviceEventEmitter.emit("onScroll", offsetY);
                }}
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