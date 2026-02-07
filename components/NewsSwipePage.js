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
import apiFetch from "../utils/apiFetch";
import AnimeLoading from "./AnimeLoading";
import { NativeAdPostStyle } from "./NativeAd";
import PostCard from "./PostCard";
import { SyncLoading } from "./SyncLoading";
import { Text } from "./Text";

const { width } = Dimensions.get('window');
const API_BASE = "https://oreblogda.com/api";
const LIMIT = 10;

export default function NewsSwipePage() {
    // 🔹 HARDCODED ID for the swipe-right section
    const id = "news"; 
    
    const insets = useSafeAreaInsets();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";
    const pulseAnim = useRef(new Animated.Value(0)).current;

    const categoryName = "News";
    const CACHE_KEY = `CATEGORY_CACHE_NEWS`;

    const [posts, setPosts] = useState([]);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
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

    const loadCachedData = async () => {
        try {
            const cached = await AsyncStorage.getItem(CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed?.length > 0) setPosts(parsed);
            }
        } catch (e) { console.error("Cache Load Error:", e); }
    };

    const fetchPosts = async (pageNum = 1, isRefresh = false) => {
        if (loading || (!hasMore && !isRefresh)) return;
        setLoading(true);
        try {
            const res = await apiFetch(`${API_BASE}/posts?category=${categoryName}&page=${pageNum}&limit=${LIMIT}`);
            const data = await res.json();
            const newPosts = data.posts || [];
            setPosts((prev) => {
                const updatedList = isRefresh 
                    ? newPosts 
                    : Array.from(new Map([...prev, ...newPosts].map(p => [p._id, p])).values());
                if (updatedList.length > 0) AsyncStorage.setItem(CACHE_KEY, JSON.stringify(updatedList));
                return updatedList;
            });
            setHasMore(newPosts.length === LIMIT);
            setPage(pageNum + 1);
            setIsOfflineMode(false);
        } catch (e) {
            setIsOfflineMode(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCachedData().then(() => fetchPosts(1, true));
    }, []);

    const renderItem = ({ item, index }) => (
        <View className="px-4">
            <PostCard post={item} isFeed />
            {(index + 1) % 4 === 0 && <NativeAdPostStyle isDark={isDark} />}
        </View>
    );

    if (loading && posts.length === 0) {
        return <AnimeLoading message="Loading Posts" subMessage="Category: News" />;
    }

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
            <FlatList
                ref={scrollRef}
                data={posts}
                keyExtractor={(item) => item._id}
                renderItem={renderItem}
                ListHeaderComponent={ListHeader}
                contentContainerStyle={{ paddingTop: insets.top + 50, paddingBottom: insets.bottom + 100 }}
                onEndReached={() => !isOfflineMode && fetchPosts(page)}
                onRefresh={() => fetchPosts(1, true)}
                refreshing={loading && posts.length > 0}
                onScroll={(e) => DeviceEventEmitter.emit("onScroll", e.nativeEvent.contentOffset.y)}
                scrollEventThrottle={16}
                ListFooterComponent={() => (
                    <View className="py-12 items-center justify-center">
                        {loading ? <SyncLoading /> : !hasMore && <Text className="text-gray-400">End of Archive</Text>}
                    </View>
                )}
            />
        </View>
    );
}