import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams } from "expo-router";
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
import AnimeLoading from "../../../components/AnimeLoading";
import { NativeAdPostStyle } from "../../../components/NativeAd";
import PostCard from "../../../components/PostCard";
import { SyncLoading } from "../../../components/SyncLoading";
import { Text } from "../../../components/Text";
import apiFetch from "../../../utils/apiFetch";
const { width } = Dimensions.get('window');

const API_BASE = "https://oreblogda.com/api";
const LIMIT = 10;

export default function CategoryPage() {
    const { id } = useLocalSearchParams();
    const insets = useSafeAreaInsets();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";

    // 🔹 Animation Value for the HUD Pulse
    const pulseAnim = useRef(new Animated.Value(0)).current;

    const categoryName = id
        ? id.includes("-")
            ? id.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("/")
            : id.charAt(0).toUpperCase() + id.slice(1).toLowerCase()
        : "";

    // 🔹 Unique Cache Key
    const CACHE_KEY = `CATEGORY_CACHE_${categoryName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;

    const [posts, setPosts] = useState([]);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [isOfflineMode, setIsOfflineMode] = useState(false); // 🔹 UI State
    const scrollRef = useRef(null);

    // 🔹 1. Pulse Animation Loop
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

    // 🔹 2. Scroll Listener
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener("doScrollToTop", () => {
            scrollRef.current?.scrollToOffset({ offset: 0, animated: true });
        });
        return () => sub.remove();
    }, []);

    // 🔹 3. Cache Logic
    const loadCachedData = async () => {
        try {
            const cached = await AsyncStorage.getItem(CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed && parsed.length > 0) {
                    setPosts(parsed);
                }
            }
        } catch (e) {
            console.error("Cache Load Error:", e);
        }
    };

    const fetchPosts = async (pageNum = 1, isRefresh = false) => {
        if (loading || (!hasMore && !isRefresh)) return;

        setLoading(true);
        try {
            const res = await apiFetch(
                `${API_BASE}/posts?category=${categoryName}&page=${pageNum}&limit=${LIMIT}`
            );
            const data = await res.json();
            const newPosts = data.posts || [];

            setPosts((prev) => {
                const updatedList = isRefresh 
                    ? newPosts 
                    : Array.from(new Map([...prev, ...newPosts].map(p => [p._id, p])).values());
                
                // 🔹 Save to Cache on Success
                if (updatedList.length > 0) {
                    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(updatedList));
                }
                return updatedList;
            });

            setHasMore(newPosts.length === LIMIT);
            setPage(pageNum + 1);
            setIsOfflineMode(false); // ✅ Connection Good
        } catch (e) {
            console.error("Category Fetch Error:", e);
            setIsOfflineMode(true); // ❌ Connection Failed
        } finally {
            setLoading(false);
        }
    };

    // 🔹 4. Initial Load (Cache First, Then Network)
    useEffect(() => {
        const init = async () => {
            await loadCachedData(); // Show something instantly
            fetchPosts(1, true);    // Try to update in background
        };
        init();
    }, [id]);

    const renderItem = ({ item, index }) => {
        const showAd = (index + 1) % 4 === 0;

        return (
            <View className="px-4">
                <PostCard post={item} isFeed />
                {showAd && (
                    <NativeAdPostStyle isDark={isDark} />
                )}
            </View>
        );
    };

    if (loading && posts.length === 0) {
        return <AnimeLoading message="Loading Posts" subMessage={`Category: ${categoryName}`} />;
    }

    // --- HEADER: Archive Sector HUD (Updated Colors) ---
    const ListHeader = () => (
        <View className="px-5 mb-10 pb-6 border-b-2 border-gray-100 dark:border-gray-800">
            <View className="flex-row items-center gap-3 mb-2">
                <View className={`h-2 w-2 rounded-full shadow-[0_0_10px] ${isOfflineMode ? 'bg-orange-500 shadow-orange-500' : 'bg-blue-600 shadow-blue-600'}`} />
                <Text className={`text-[10px] font-[900] uppercase tracking-[0.4em] ${isOfflineMode ? 'text-orange-500' : 'text-blue-600'}`}>
                    {isOfflineMode ? "Archived Sector // Offline" : "Archive Sector Online"}
                </Text>
            </View>
            
            <View className="relative">
                <Text 
                    className={`text-4xl font-[900] italic tracking-tighter uppercase ${
                        isDark ? "text-white" : "text-gray-900"
                    }`}
                >
                    Folder: <Text className={isOfflineMode ? "text-orange-500" : "text-blue-600"}>{categoryName}</Text>
                </Text>
                {/* Tactical Accent */}
                <View className={`absolute -bottom-2 left-0 h-[2px] w-20 shadow-[0_0_8px] ${isOfflineMode ? 'bg-orange-500 shadow-orange-500' : 'bg-blue-600 shadow-blue-600'}`} />
            </View>
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: isDark ? "#050505" : "#ffffff" }}>
            {/* --- LAYER 1: ATMOSPHERIC BACKGROUND EFFECTS --- */}
            <View 
                pointerEvents="none"
                className="absolute -top-20 -right-20 rounded-full opacity-[0.08]"
                style={{ 
                    width: width * 0.7, 
                    height: width * 0.7, 
                    backgroundColor: isOfflineMode ? '#f97316' : (isDark ? '#2563eb' : '#3b82f6'),
                }} 
            />
            
            <View 
                pointerEvents="none"
                className="absolute bottom-20 -left-20 rounded-full opacity-[0.05]"
                style={{ 
                    width: width * 0.6, 
                    height: width * 0.6, 
                    backgroundColor: isOfflineMode ? '#f97316' : (isDark ? '#4f46e5' : '#60a5fa'),
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
                                {isOfflineMode && (
                                    <Text className="text-[10px] mt-4 font-bold uppercase tracking-widest text-orange-500 text-center">
                                        Check your connection
                                    </Text>
                                )}
                            </View>
                        ) : null}
                    </View>
                )}

                onEndReached={() => !isOfflineMode && fetchPosts(page)}
                onEndReachedThreshold={0.5}
                onRefresh={() => fetchPosts(1, true)}
                refreshing={loading && posts.length > 0}
                onScroll={(e) => {
                    DeviceEventEmitter.emit("onScroll", e.nativeEvent.contentOffset.y);
                }}
                scrollEventThrottle={16}
            />

            {/* --- 🔹 TACTICAL HUD DECOR (The Pulse Animation) --- */}
            <View
                className="absolute left-6 flex-row items-center gap-2"
                style={{ bottom: insets.bottom + 20, opacity: 0.6 }}
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

            {/* Side Bar Decoration */}
            <View 
                className={`absolute right-0 top-1/2 -translate-y-1/2 h-20 w-1 opacity-20 rounded-l-full ${isOfflineMode ? 'bg-orange-500' : 'bg-blue-600'}`} 
                pointerEvents="none"
            />
        </View>
    );
}
