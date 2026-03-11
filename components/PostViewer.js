import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    AppState,
    DeviceEventEmitter,
    Easing,
    InteractionManager,
    RefreshControl,
    View
} from "react-native";
// ⚡️ LegendList: The JS-native high-performance list
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

const shuffleArray = (array) => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
};

export default function PostsViewer() {
    const storage = useMMKV(); 
    
    const scrollRef = useRef(null);
    const insets = useSafeAreaInsets();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";
    const appState = useRef(AppState.currentState);

    const [ready, setReady] = useState(false);
    const [canFetch, setCanFetch] = useState(false);
    const [cachedData, setCachedData] = useState(SESSION_STATE.memoryCache);
    const [isOfflineMode, setIsOfflineMode] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const shuffledPagesRef = useRef({});
    const pulseAnim = useRef(new Animated.Value(0)).current;

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
        let isMounted = true;
        const prepare = () => {
            try {
                if (!SESSION_STATE.memoryCache) {
                    const local = storage.getString(CACHE_KEY);
                    if (local && isMounted) {
                        const parsed = JSON.parse(local);
                        if (parsed && Array.isArray(parsed.data)) {
                            setCachedData(parsed.data);
                            SESSION_STATE.memoryCache = parsed.data;
                        }
                    }
                }
            } catch (e) {
                console.error("MMKV load error", e);
            }

            InteractionManager.runAfterInteractions(() => {
                if (isMounted) {
                    setReady(true);
                    setTimeout(() => {
                        if (isMounted) setCanFetch(true);
                    }, 400); 
                }
            });
        };
        prepare();
        return () => { isMounted = false; };
    }, [storage]);

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
        if (!ready || !canFetch) return null;
        if (previousPageData && previousPageData.posts?.length < LIMIT) return null;
        return `/posts?page=${pageIndex + 1}&limit=${LIMIT}`;
    };

    const { data, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite(getKey, fetcher, {
        refreshInterval: 0,
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        revalidateIfStale: false,
        revalidateOnMount: !SESSION_STATE.hasFetched,
        dedupingInterval: 10000,
        fallbackData: cachedData || undefined,
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
        shuffledPagesRef.current = {};
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

        sourceData.forEach((page, index) => {
            if (page?.posts && Array.isArray(page.posts)) {
                const pageKey = page.posts[0]?._id || `page-${index}`;

                if (!shuffledPagesRef.current[pageKey]) {
                    shuffledPagesRef.current[pageKey] = shuffleArray(page.posts);
                }

                const shuffledBatch = shuffledPagesRef.current[pageKey];

                shuffledBatch.forEach((p) => {
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
        if (!hasMore || isValidating || !ready || isLoading || isOfflineMode) return;
        setSize(size + 1);
    }, [hasMore, isValidating, ready, isLoading, isOfflineMode, size, setSize]);

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

    // Requirement: Show loading animation when loading
    if (!ready || (isLoading && posts.length === 0)) {
        return <AnimeLoading message="Loading Posts" subMessage="Prepping Otaku content" />
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
                
                // PERFORMANCE TUNING FOR DEV MODE
                estimatedItemSize={600} 
                drawDistance={2000} // Pre-renders more items in Dev to ensure zero blanking
                recycleItems={true} // Reuses views similar to FlashList but with JS logic
                
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
                            <SyncLoading /> // Required loading animation
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
                <Animated.Text
                    style={{ opacity: pulseAnim }}
                    className={`text-[8px] font-[900] uppercase tracking-[0.4em] ${isOfflineMode ? 'text-orange-500' : 'text-blue-600'}`}
                >
                    {isOfflineMode ? "Cache_Relay_Active" : "Neural_Link_Established"}
                </Animated.Text>
            </View>
        </View>
    );
}