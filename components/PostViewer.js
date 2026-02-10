import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "nativewind";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    DeviceEventEmitter,
    Dimensions,
    Easing,
    FlatList,
    InteractionManager,
    View,
    Platform
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import useSWRInfinite from "swr/infinite";
import apiFetch from "../utils/apiFetch";
import AnimeLoading from "./AnimeLoading";
import { NativeAdPostStyle } from "./NativeAd";
import PostCard from "./PostCard";
import { SyncLoading } from "./SyncLoading";
import { Text } from "./Text";

const fetcher = (url) => apiFetch(url).then(res => res.json());

const { width } = Dimensions.get('window');
const LIMIT = 15;
const CACHE_KEY = "POSTS_CACHE_V1";

// 🧠 Tier 1: Memory Cache
let POSTS_MEMORY_CACHE = null;

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

export default function PostsViewer() {
    const scrollRef = useRef(null);
    const insets = useSafeAreaInsets();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";

    const [ready, setReady] = useState(false);
    const [canFetch, setCanFetch] = useState(false); // 🚀 New: Delay fetching until UI is idle
    const [cachedData, setCachedData] = useState(POSTS_MEMORY_CACHE); 
    const [isOfflineMode, setIsOfflineMode] = useState(false);

    const pulseAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const prepare = async () => {
            try {
                if (!POSTS_MEMORY_CACHE) {
                    const local = await AsyncStorage.getItem(CACHE_KEY);
                    if (local) {
                        const parsed = JSON.parse(local);
                        setCachedData(parsed.data);
                        POSTS_MEMORY_CACHE = parsed.data;
                    }
                }
            } catch (e) {
                console.error("Cache load error", e);
            }

            // 🚀 Wait for navigation to finish before marking ready and allowing fetch
            InteractionManager.runAfterInteractions(() => {
                setReady(true);
                // Extra 400ms buffer to ensure thread is completely free
                setTimeout(() => setCanFetch(true), 400);
            });
        };
        prepare();
    }, []);

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1500,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 0,
                    duration: 1500,
                    easing: Easing.linear,
                    useNativeDriver: true,
                })
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [pulseAnim]);

    const getKey = (pageIndex, previousPageData) => {
        // 🚀 CRITICAL: Do not fetch until the UI thread is free (canFetch)
        if (!ready || !canFetch) return null;
        if (previousPageData && previousPageData.posts?.length < LIMIT) return null;
        return `/posts?page=${pageIndex + 1}&limit=${LIMIT}`;
    };

    const { data, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite(getKey, fetcher, {
        refreshInterval: isOfflineMode ? 0 : 60000,
        revalidateOnFocus: false,
        dedupingInterval: 10000, // Increased to reduce thread noise
        fallbackData: cachedData, 
        onSuccess: (newData) => {
            setIsOfflineMode(false);
            POSTS_MEMORY_CACHE = newData;
            saveHeavyCache(CACHE_KEY, newData);
        },
        onError: () => {
            setIsOfflineMode(true);
        }
    });

    const posts = useMemo(() => {
        const sourceData = data || cachedData;
        if (!sourceData || !Array.isArray(sourceData)) return [];

        const postMap = new Map();
        sourceData.forEach(page => {
            if (page?.posts) {
                page.posts.forEach(p => {
                    if (p?._id) postMap.set(p._id, p);
                });
            }
        });
        return Array.from(postMap.values());
    }, [data, cachedData]);

    const hasMore = data?.[data.length - 1]?.posts?.length === LIMIT;

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener("doScrollToTop", () => {
            scrollRef.current?.scrollToOffset({ offset: 0, animated: true });
        });
        return () => sub.remove();
    }, []);

    const loadMore = () => {
        if (!hasMore || isValidating || !ready || isLoading || isOfflineMode) return;
        setSize(size + 1);
    };

    // Show loading only if we have literally nothing to show
    if (!ready && posts.length === 0) {
        return <AnimeLoading message="Loading posts" subMessage="Prepping Otaku content" />
    }

    const renderItem = ({ item, index }) => {
        const showAd = (index + 1) % 4 === 0;

        return (
            <View key={item._id}>
                <PostCard post={item} isFeed posts={posts} setPosts={mutate} />
                {showAd && ready && canFetch && (
                    <NativeAdPostStyle isDark={isDark} />
                )}
            </View>
        );
    };

    const ListHeader = () => (
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
    );

    return (
        <View className={`flex-1 ${isDark ? "bg-[#050505]" : "bg-white"}`}>
            <FlatList
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
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
                
                // ⚡️ PERFORMANCE OPTIONS
                removeClippedSubviews={Platform.OS === 'android'}
                initialNumToRender={5} 
                maxToRenderPerBatch={4}
                windowSize={3} // 🚀 Keeps memory lean for horizontal swiping
                updateCellsBatchingPeriod={100} 
                onScroll={(e) => {
                    const offsetY = e.nativeEvent.contentOffset.y;
                    DeviceEventEmitter.emit("onScroll", offsetY);
                }}
                scrollEventThrottle={32}
                ListFooterComponent={
                    <View className="py-12 items-center justify-center min-h-[140px]">
                        {(isLoading && posts.length === 0) || (isValidating && posts.length > 0 && size > 1) ? (
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
