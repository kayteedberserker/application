import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from "@react-native-async-storage/async-storage"; // 👈 Added for caching
import { useColorScheme } from "nativewind";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    DeviceEventEmitter,
    Dimensions,
    Easing,
    FlatList,
    InteractionManager,
    View
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

const { width, height } = Dimensions.get('window');
const LIMIT = 15;
const API_URL = "https://oreblogda.com/api/posts";
const CACHE_KEY = "POSTS_CACHE_V1"; // 👈 Unique key for storage

// Standard fetcher
export default function PostsViewer() {
    const scrollRef = useRef(null);
    const insets = useSafeAreaInsets();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";

    const [ready, setReady] = useState(false);
    const [cachedData, setCachedData] = useState(null); // 👈 State for old data
    const [isOfflineMode, setIsOfflineMode] = useState(false); // 👈 State for UI toggle

    const pulseAnim = useRef(new Animated.Value(0)).current;

    // 1. Initial Setup: Load Cache & Animation
    useEffect(() => {
        const prepare = async () => {
            try {
                // Try to load saved data immediately
                const local = await AsyncStorage.getItem(CACHE_KEY);
                if (local) {
                    setCachedData(JSON.parse(local));
                }
            } catch (e) {
                console.error("Cache load error", e);
            }

            InteractionManager.runAfterInteractions(() => {
                setReady(true);
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
        if (!ready) return null;
        if (previousPageData && previousPageData.posts?.length < LIMIT) return null;
        return `${API_URL}?page=${pageIndex + 1}&limit=${LIMIT}`;
    };

    // 2. SWR Implementation with Fallback & Error Handling
    const { data, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite(getKey, fetcher, {
        refreshInterval: isOfflineMode ? 0 : 15000, // Stop polling if offline
        revalidateOnFocus: false,
        dedupingInterval: 5000,
        fallbackData: cachedData, // 👈 Use cached data while loading
        onSuccess: (newData) => {
            setIsOfflineMode(false); // Connection is good!
            AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newData)); // Save fresh data
        },
        onError: (err) => {
            console.log("Fetch failed, assuming offline mode");
            setIsOfflineMode(true); // Connection failed, show cached UI
        }
    });

    // OPTIMIZATION: Memoize the posts array
    // We prioritize 'data' (live), but fallback to 'cachedData' if data is empty/null
    const posts = useMemo(() => {
        const sourceData = data || cachedData;
        if (!sourceData) return [];

        const postMap = new Map();
        sourceData.forEach(page => {
            if (page?.posts) {
                page.posts.forEach(p => postMap.set(p._id, p));
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
    if (!ready) {
        return <AnimeLoading message="Loading posts" subMessage="Prepping Otaku content" />
    }

    const renderItem = ({ item, index }) => {
        const showAd = (index + 1) % 4 === 0;

        return (
            <View>
                <PostCard post={item} isFeed posts={posts} setPosts={mutate} />
                {showAd && ready && (
                    <NativeAdPostStyle isDark={isDark} />
                )}
            </View>
        );
    };



    const ListHeader = () => (
        <View className="mb-10 pb-2">
            <View className="flex-row items-center gap-3 mb-1">
                {/* Status Dot changes color based on Offline Mode */}
                <View className={`h-2 w-2 rounded-full ${isOfflineMode ? 'bg-orange-500' : 'bg-blue-600'}`} />
                <Text className={`text-[10px] font-[900] uppercase tracking-[0.4em] ${isOfflineMode ? 'text-orange-500' : 'text-blue-600'}`}>
                    {isOfflineMode ? "Archived Intel // Offline" : "Live Feed Active"}
                </Text>
            </View>
            <View className="relative">
                <Text
                    className={`text-5xl font-[900] italic tracking-tighter uppercase ${isDark ? "text-white" : "text-gray-900"}`}
                >
                    Anime <Text className={isOfflineMode ? "text-orange-500" : "text-blue-600"}>Intel</Text>
                </Text>
                <View className={`h-[2px] w-24 mt-2 ${isOfflineMode ? 'bg-orange-500' : 'bg-blue-600'}`} />
            </View>
        </View>
    );

    return (
        <View className={`flex-1 ${isDark ? "bg-[#050505]" : "bg-white"}`}>
            <View
                className="absolute left-0 right-0 z-50"
                style={{
                    top: insets.top,
                    height: 1,
                    opacity: 0.3,
                    width: '100%'
                }}
            />

            <FlatList
                ref={scrollRef}
                data={posts}
                keyExtractor={(item) => item._id}
                ListHeaderComponent={ListHeader}
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingTop: insets.top + 20,
                    paddingBottom: insets.bottom + 100,
                }}
                renderItem={renderItem}
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}

                removeClippedSubviews={true}
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                windowSize={5}
                updateCellsBatchingPeriod={50}

                onScroll={(e) => {
                    const offsetY = e.nativeEvent.contentOffset.y;
                    DeviceEventEmitter.emit("onScroll", offsetY);
                }}
                scrollEventThrottle={32}
                ListFooterComponent={
                    <View className="py-12 items-center justify-center min-h-[140px]">
                        {isLoading || isValidating ? (
                            <SyncLoading />
                        ) : !hasMore && posts.length > 0 ? (
                            <Text className="text-[10px] font-[900] uppercase tracking-[0.5em] text-gray-400">
                                End of Transmission
                            </Text>
                        ) : posts.length === 0 ? (
                            <View className="py-20 px-10">
                                <Text className="text-2xl font-[900] uppercase italic text-gray-400 text-center mb-2">
                                    No Intel Found
                                </Text>
                                {isOfflineMode && (
                                    <Text className="text-[10px] font-bold uppercase tracking-widest text-orange-500 text-center">
                                        Check your connection
                                    </Text>
                                )}
                            </View>
                        ) : null
                        }
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
