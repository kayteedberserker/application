import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from "expo-router";
import { useColorScheme } from "nativewind";
import { useEffect, useRef, useState } from "react";
import {
    DeviceEventEmitter,
    Dimensions,
    FlatList,
    Text as RNText,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AnimeLoading from "../../../components/AnimeLoading";
import AppBanner from "../../../components/AppBanner";
import PostCard from "../../../components/PostCard";
import { SyncLoading } from "../../../components/SyncLoading";
import { Text } from "../../../components/Text";
const { width } = Dimensions.get('window');

const API_BASE = "https://oreblogda.com/api";
const LIMIT = 5;

export default function CategoryPage() {
    const { id } = useLocalSearchParams();
    const insets = useSafeAreaInsets();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";

    const categoryName = id
        ? id.includes("-")
            ? id.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("/")
            : id.charAt(0).toUpperCase() + id.slice(1).toLowerCase()
        : "";

    const [posts, setPosts] = useState([]);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const scrollRef = useRef(null);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener("doScrollToTop", () => {
            scrollRef.current?.scrollToOffset({ offset: 0, animated: true });
        });
        return () => sub.remove();
    }, []);

    const fetchPosts = async (pageNum = 1, isRefresh = false) => {
        if (loading || (!hasMore && !isRefresh)) return;

        setLoading(true);
        try {
            const res = await fetch(
                `${API_BASE}/posts?category=${categoryName}&page=${pageNum}&limit=${LIMIT}`
            );
            const data = await res.json();
            const newPosts = data.posts || [];

            setPosts((prev) => {
                if (isRefresh) return newPosts;
                const map = new Map([...prev, ...newPosts].map(p => [p._id, p]));
                return Array.from(map.values());
            });

            setHasMore(newPosts.length === LIMIT);
            setPage(pageNum + 1);
        } catch (e) {
            console.error("Category Fetch Error:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPosts(1, true);
    }, [id]);

    const renderItem = ({ item, index }) => {
        const showAd = (index + 1) % 4 === 0;

        return (
            <View className="px-4">
                <PostCard post={item} isFeed />

                {showAd && (
                    <View className="mb-8 mt-2 items-center bg-gray-50 dark:bg-gray-800/30 py-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                        <RNText className="text-[10px] text-gray-400 mb-2 uppercase tracking-widest">Sponsored Transmission</RNText>
                        <AppBanner size="MEDIUM_RECTANGLE" />
                    </View>
                )}
            </View>
        );
    };

    if (loading && posts.length === 0) {
        return <AnimeLoading message="Loading Posts" subMessage={`Category: ${categoryName}`} />;
    }

    // --- HEADER: Archive Sector HUD ---
    const ListHeader = () => (
        <View className="px-5 mb-10 pb-6 border-b-2 border-gray-100 dark:border-gray-800">
            <View className="flex-row items-center gap-3 mb-2">
                <View className="h-2 w-2 bg-blue-600 rounded-full shadow-[0_0_10px_#2563eb]" />
                <Text className="text-[10px] font-[900] uppercase tracking-[0.4em] text-blue-600">
                    Archive Sector
                </Text>
            </View>
            
            <View className="relative">
                <Text 
                    className={`text-4xl font-[900] italic tracking-tighter uppercase ${
                        isDark ? "text-white" : "text-gray-900"
                    }`}
                >
                    Folder: <Text className="text-blue-600">{categoryName}</Text>
                </Text>
                {/* Tactical Accent */}
                <View className="absolute -bottom-2 left-0 h-[2px] w-20 bg-blue-600 shadow-[0_0_8px_#2563eb]" />
            </View>
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: isDark ? "#050505" : "#ffffff" }}>
            {/* --- LAYER 1: ATMOSPHERIC BACKGROUND EFFECTS --- */}
            {/* Top Right Glow */}
            <View 
                pointerEvents="none"
                className="absolute -top-20 -right-20 rounded-full opacity-[0.08]"
                style={{ 
                    width: width * 0.7, 
                    height: width * 0.7, 
                    backgroundColor: isDark ? '#2563eb' : '#3b82f6',
                }} 
            />
            
            {/* Bottom Left Glow */}
            <View 
                pointerEvents="none"
                className="absolute bottom-20 -left-20 rounded-full opacity-[0.05]"
                style={{ 
                    width: width * 0.6, 
                    height: width * 0.6, 
                    backgroundColor: isDark ? '#4f46e5' : '#60a5fa',
                }} 
            />

            {/* --- MAIN CONTENT ENGINE --- */}
            <FlatList
                ref={scrollRef}
                data={posts}
                keyExtractor={(item) => item._id}
                renderItem={renderItem}
                ListHeaderComponent={ListHeader}
                
                contentContainerStyle={{
                    paddingTop: insets.top + 20,
                    paddingBottom: insets.bottom + 100,
                }}

                ListFooterComponent={() => (
                    <View className="py-12 items-center justify-center min-h-[140px]">
                        {loading ? (
                            <SyncLoading />
                        ) : !hasMore && posts.length > 0 ? (
                            <View className="items-center">
                                <View className="h-[1px] w-12 bg-gray-200 dark:bg-gray-800 mb-4" />
                                <Text className="text-[10px] font-[900] uppercase tracking-[0.5em] text-gray-400">
                                    End of {categoryName} Archive
                                </Text>
                            </View>
                        ) : posts.length === 0 && !loading ? (
                            <View className="py-20 px-10 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-[40px] mx-5 items-center">
                                <MaterialCommunityIcons name="folder-alert-outline" size={40} color="#4b5563" />
                                <Text className="text-gray-500 font-[900] uppercase italic tracking-widest mt-4 text-center">
                                    No records found in{"\n"}
                                    <Text className="text-blue-600">{categoryName}</Text>
                                </Text>
                            </View>
                        ) : null}
                    </View>
                )}

                // --- FUNCTIONAL LOGIC (Kept intact) ---
                onEndReached={() => fetchPosts(page)}
                onEndReachedThreshold={0.5}
                onRefresh={() => fetchPosts(1, true)}
                refreshing={loading && posts.length > 0}
                onScroll={(e) => {
                    DeviceEventEmitter.emit("onScroll", e.nativeEvent.contentOffset.y);
                }}
                scrollEventThrottle={16}
            />

            {/* --- TACTICAL HUD DECOR (Sidebar-style element for Mobile) --- */}
            <View 
                className="absolute right-0 top-1/2 -translate-y-1/2 h-20 w-1 bg-blue-600 opacity-20 rounded-l-full" 
                pointerEvents="none"
            />
        </View>
    );
}
