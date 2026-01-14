import { MaterialCommunityIcons } from '@expo/vector-icons';
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
import AnimeLoading from "./AnimeLoading";
import AppBanner from './AppBanner';
import PostCard from "./PostCard";
import { SyncLoading } from "./SyncLoading";
import { Text } from "./Text";

const { width, height } = Dimensions.get('window');
const LIMIT = 5;
const API_URL = "https://oreblogda.com/api/posts";

const fetcher = (url) => fetch(url).then(res => res.json());

export default function PostsViewer() {
    const scrollRef = useRef(null);
    const insets = useSafeAreaInsets();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";
    const [ready, setReady] = useState(false);

    const pulseAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const task = InteractionManager.runAfterInteractions(() => {
            setReady(true);
        });
        return () => task.cancel();
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
        return () => animation.stop(); // Cleanup animation on unmount
    }, [pulseAnim]);

    const getKey = (pageIndex, previousPageData) => {
        if (!ready) return null;
        if (previousPageData && previousPageData.posts?.length < LIMIT) return null;
        return `${API_URL}?page=${pageIndex + 1}&limit=${LIMIT}`;
    };

    const { data, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite(getKey, fetcher, {
        refreshInterval: 15000, // Slightly increased to give weak CPUs a breather
        revalidateOnFocus: false, // Turn off for weak devices to prevent random crashes
        dedupingInterval: 5000,
    });

    // OPTIMIZATION: Memoize the posts array so it doesn't re-calculate on every render
    const posts = useMemo(() => {
        if (!data) return [];
        const postMap = new Map();
        data.forEach(page => {
            if (page.posts) {
                page.posts.forEach(p => postMap.set(p._id, p));
            }
        });
        return Array.from(postMap.values());
    }, [data]);

    const hasMore = data?.[data.length - 1]?.posts?.length === LIMIT;

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener("doScrollToTop", () => {
            scrollRef.current?.scrollToOffset({ offset: 0, animated: true });
        });
        return () => sub.remove(); // Cleanup listener
    }, []);

    const loadMore = () => {
        if (!hasMore || isValidating || !ready || isLoading) return;
        setSize(size + 1);
    };

    const renderItem = ({ item, index }) => {
        const showAd = (index + 1) % 4 === 0;

        return (
            <View>
                <PostCard post={item} isFeed posts={posts} setPosts={mutate} />
                {showAd && ready && (
                    <View className="mb-8 mt-3 w-full p-6 border border-dashed border-gray-300 dark:border-gray-800 rounded-[32px] bg-gray-50/50 dark:bg-white/5 items-center justify-center">
                        <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] italic text-center">
                            Sponsored Transmission
                        </Text>
                        <AppBanner size="MEDIUM_RECTANGLE" />
                    </View>
                )}
            </View>
        );
    };

    if (!ready) {
        return <AnimeLoading message="Loading Posts" subMessage="Preparing content" />;
    }

    const ListHeader = () => (
        <View className="mb-10 pb-2">
            <View className="flex-row items-center gap-3 mb-1">
                <View className="h-2 w-2 bg-blue-600 rounded-full" />
                <Text className="text-[10px] font-[900] uppercase tracking-[0.4em] text-blue-600">
                    Live Feed Active
                </Text>
            </View>
            <View className="relative">
                <Text
                    className={`text-5xl font-[900] italic tracking-tighter uppercase ${isDark ? "text-white" : "text-gray-900"
                        }`}
                >
                    Anime <Text className="text-blue-600">Intel</Text>
                </Text>
                <View className="h-[2px] w-24 bg-blue-600 mt-2" />
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
                onEndReachedThreshold={0.5} // Trigger earlier to avoid "jank"
                
                // CRITICAL FOR SAMSUNG A30 PERFORMANCE
                removeClippedSubviews={true} 
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                windowSize={5}
                updateCellsBatchingPeriod={50}

                onScroll={(e) => {
                    const offsetY = e.nativeEvent.contentOffset.y;
                    DeviceEventEmitter.emit("onScroll", offsetY);
                }}
                scrollEventThrottle={32} // Reduced frequency to save CPU cycles
                ListFooterComponent={
                    <View className="py-12 items-center justify-center min-h-[140px]">
                        {isLoading || isValidating ? (
                            <SyncLoading />
                        ) : !hasMore && posts.length > 0 ? (
                            <Text className="text-[10px] font-[900] uppercase tracking-[0.5em] text-gray-400">
                                End of Transmission
                            </Text>
                        ) : posts.length === 0 ? (
                            <View className="py-20">
                                <Text className="text-2xl font-[900] uppercase italic text-gray-400">
                                    No Intel Found
                                </Text>
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
                <MaterialCommunityIcons name="pulse" size={14} color="#2563eb" />
                <Animated.Text 
                    style={{ opacity: pulseAnim }}
                    className="text-[8px] font-[900] uppercase tracking-[0.4em] text-blue-600"
                >
                    Neural_Link_Established // Mobile_v4.0
                </Animated.Text>
            </View>
        </View>
    );
}
