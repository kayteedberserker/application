import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    TextInput,
    TouchableOpacity,
    FlatList,
    Image,
    ActivityIndicator,
    SafeAreaView,
    Keyboard,
    Platform,
    StatusBar,
    ScrollView,
    useColorScheme 
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons"; // Added MaterialCommunityIcons for aura icons
import { useRouter } from "expo-router";
import apiFetch from "../../utils/apiFetch";
import { Text } from "../../components/Text"; 
import Animated, { FadeInDown, FadeIn, Layout } from "react-native-reanimated";
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- HELPER: RESOLVE WRITER RANK ---
const resolveUserRank = (totalPosts) => {
    const count = totalPosts || 0;
    if (count >= 200) return { title: "MASTER_WRITER", icon: "👑", color: "#fbbf24", next: 500 };
    if (count > 150) return { title: "ELITE_WRITER", icon: "💎", color: "#60a5fa", next: 200 };
    if (count > 100) return { title: "SENIOR_WRITER", icon: "🔥", color: "#f87171", next: 150 };
    if (count > 50) return { title: "NOVICE_WRITER", icon: "⚔️", color: "#a78bfa", next: 100 };
    if (count > 25) return { title: "RESEACHER_SR", icon: "📜", color: "#34d399", next: 50 };
    return { title: "RESEACHER_JR", icon: "🛡️", color: "#94a3b8", next: 25 };
};

// --- AUTHOR CARD COMPONENT ---
const AuthorCard = ({ author, isDark }) => {
    const router = useRouter();
    
    // 🔹 UPDATED AURA VISUALS LOGIC
    const getAuraVisuals = (rank) => {
        if (!rank || rank > 10 || rank <= 0) return { color: isDark ? '#1e293b' : '#cbd5e1', label: 'OPERATIVE', icon: 'target' };
        switch (rank) {
            case 1: return { color: '#fbbf24', label: 'MONARCH', icon: 'crown' };
            case 2: return { color: '#ef4444', label: 'YONKO', icon: 'flare' };
            case 3: return { color: '#a855f7', label: 'KAGE', icon: 'moon-waxing-crescent' };
            case 4: return { color: '#3b82f6', label: 'SHOGUN', icon: 'shield-star' };
            case 5: return { color: '#e0f2fe', label: 'ESPADA 0', icon: 'skull' }; // Reiatsu White
            case 6: return { color: '#cbd5e1', label: 'ESPADA 1', icon: 'sword-cross' };
            case 7: return { color: '#94a3b8', label: 'ESPADA 2', icon: 'sword-cross' };
            case 8: return { color: '#64748b', label: 'ESPADA 3', icon: 'sword-cross' };
            case 9: return { color: '#475569', label: 'ESPADA 4', icon: 'sword-cross' };
            case 10: return { color: '#334155', label: 'ESPADA 5', icon: 'sword-cross' };
            default: return { color: '#1e293b', label: 'OPERATIVE', icon: 'target' };
        }
    };

    const tier = getAuraVisuals(author.previousRank);
    const writerRank = resolveUserRank(author.postsCount);

    return (
        <Animated.View entering={FadeInDown.duration(400)} layout={Layout.springify()}>
            <TouchableOpacity
                onPress={() => router.push(`/author/${author._id}`)}
                className={`mb-3 p-4 rounded-3xl border ${
                    isDark ? "bg-[#0f0f0f] border-zinc-800" : "bg-white border-zinc-100 shadow-sm"
                }`}
            >
                <View className="flex-row items-center">
                    <View style={{ borderColor: tier.color }} className="w-16 h-16 rounded-full border-2 p-0.5">
                        <Image
                            source={{ uri: author.profilePic?.url || "https://oreblogda.com/default-avatar.png" }}
                            className="w-full h-full rounded-full bg-zinc-200 dark:bg-zinc-800"
                        />
                    </View>

                    <View className="flex-1 ml-4 justify-center">
                        <View className="flex-row items-center justify-between mb-1">
                            <View className="flex-row items-center flex-1 mr-2">
                                <Text numberOfLines={1} className={`font-black italic uppercase tracking-tighter text-lg ${isDark ? 'text-white' : 'text-black'}`}>
                                    {author.username}
                                </Text>
                            </View>
                            <View style={{ backgroundColor: `${tier.color}20`, borderColor: `${tier.color}40` }} className="px-2 py-0.5 rounded-md border flex-row items-center gap-1">
                                <MaterialCommunityIcons name={tier.icon} size={8} color={tier.color} />
                                <Text style={{ color: tier.color }} className="text-[8px] font-black uppercase tracking-widest">{tier.label}</Text>
                            </View>
                        </View>

                        <View className="flex-row items-center mb-1">
                            <Text className="text-[10px] font-black italic" style={{ color: writerRank.color }}>
                                {writerRank.icon} {writerRank.title}
                            </Text>
                        </View>

                        <Text numberOfLines={1} className={`text-[11px] font-medium italic mb-2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                            {author.description || "No bio decrypted yet..."}
                        </Text>

                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center gap-3">
                                <View className="flex-row items-center">
                                    <Ionicons name="flame" size={12} color="#f97316" />
                                    <Text className="text-[10px] font-bold ml-1 text-zinc-500">{author.lastStreak || 0}</Text>
                                </View>
                                <View className="flex-row items-center">
                                    <Ionicons name="document-text" size={12} color="#3b82f6" />
                                    <Text className="text-[10px] font-bold ml-1 text-zinc-500">{author.postsCount || 0}</Text>
                                </View>
                            </View>
                            <View className={`${isDark ? 'bg-zinc-800' : 'bg-zinc-100'} px-2 py-0.5 rounded-full border ${isDark ? 'border-zinc-700' : 'border-zinc-200'}`}>
                                <Text style={{ color: tier.color }} className="text-[9px] font-black uppercase">AURA: {author.weeklyAura || 0}</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

// --- POST SEARCH CARD ---
const PostSearchCard = ({ item, isDark }) => {
    const router = useRouter();
    return (
        <Animated.View entering={FadeIn.duration(500)} layout={Layout.springify()}>
            <TouchableOpacity 
                onPress={() => router.push(`/post/${item._id}`)}
                className={`mb-5 rounded-[2.5rem] border overflow-hidden ${isDark ? "bg-zinc-900/40 border-zinc-800" : "bg-white border-zinc-100 shadow-sm"}`}
            >
                {item.mediaUrl ? (
                    <Image source={{ uri: item.mediaUrl }} className="w-full h-48 bg-zinc-800" resizeMode="cover" />
                ) : (
                    <View className="w-full h-2 bg-blue-600" /> 
                )}
                
                <View className="p-5">
                    <View className="flex-row justify-between items-center mb-3">
                        <View className="bg-blue-600/10 border border-blue-500/20 px-3 py-1 rounded-full">
                            <Text className="text-blue-500 text-[8px] font-black uppercase tracking-widest">{item.category}</Text>
                        </View>
                        <Text className="text-zinc-500 text-[10px] font-bold uppercase tracking-tighter">
                            <Text className={`${isDark ? 'text-zinc-600' : 'text-zinc-400'} font-normal`}>OP:</Text> {item.authorName}
                        </Text>
                    </View>
                    
                    <Text className={`font-black text-xl mb-2 leading-tight tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>{item.title}</Text>
                    <Text className={`${isDark ? 'text-zinc-400' : 'text-zinc-500'} text-xs mb-5 italic`} numberOfLines={2}>{item.message}</Text>
                    
                    <View className={`flex-row items-center justify-between pt-4 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
                        <View className="flex-row items-center gap-5">
                            <View className="flex-row items-center">
                                <Ionicons name="heart-sharp" size={14} color="#ef4444" />
                                <Text className="text-[11px] font-black text-zinc-500 ml-1.5">{item.likesCount || 0}</Text>
                            </View>
                            <View className="flex-row items-center">
                                <Ionicons name="chatbubble-ellipses" size={14} color="#3b82f6" />
                                <Text className="text-[11px] font-black text-zinc-500 ml-1.5">{item.commentsCount || 0}</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

// --- MAIN SEARCH SCREEN ---
const SearchScreen = () => {
    const router = useRouter();
    const systemTheme = useColorScheme(); 
    const isDark = systemTheme === 'dark';
    
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [results, setResults] = useState({ authors: [], posts: [] });
    const [activeTab, setActiveTab] = useState("all");
    const [recentSearches, setRecentSearches] = useState([]);
    const [trending] = useState(["Solo Leveling", "Genshin Build", "Aura Guide", "Top Operatives", "Winter 2026 Anime"]);
    const [isOffline, setIsOffline] = useState(false); // 🔹 Track offline status
    
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        loadRecentSearches();
    }, []);

    const loadRecentSearches = async () => {
        const saved = await AsyncStorage.getItem('recent_searches');
        if (saved) setRecentSearches(JSON.parse(saved));
    };

    const saveSearch = async (text) => {
        if (!text || text.length < 2) return;
        const updated = [text, ...recentSearches.filter(s => s !== text)].slice(0, 5);
        setRecentSearches(updated);
        await AsyncStorage.setItem('recent_searches', JSON.stringify(updated));
    };

    const performSearch = useCallback(async (text, pageNum = 1, shouldAppend = false) => {
        if (text.length < 2) {
            setResults({ authors: [], posts: [] });
            return;
        }

        if (pageNum === 1) setLoading(true);
        else setLoadingMore(true);
        setIsOffline(false);

        try {
            const response = await apiFetch(`https://oreblogda.com/api/search?q=${encodeURIComponent(text)}&page=${pageNum}&limit=10`);
            const data = await response.json();
            
            if (response.ok) {
                setResults(prev => ({
                    authors: shouldAppend ? prev.authors : (data.users || []),
                    posts: shouldAppend ? [...prev.posts, ...data.posts] : (data.posts || [])
                }));
                setHasMore(data.pagination?.hasNextPage);
                if (pageNum === 1) saveSearch(text);
            } else {
                // Handle non-ok response as potential offline/network error
                setIsOffline(true);
            }
        } catch (error) {
            console.error("Search Error:", error);
            setIsOffline(true);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [recentSearches]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            setPage(1);
            performSearch(query, 1, false);
        }, 400);
        return () => clearTimeout(delayDebounceFn);
    }, [query]);

    const handleLoadMore = () => {
        if (!loadingMore && hasMore && query.length > 1 && !isOffline) {
            const nextPage = page + 1;
            setPage(nextPage);
            performSearch(query, nextPage, true);
        }
    };

    const renderItem = ({ item }) => {
        if (item.username) return <AuthorCard author={item} isDark={isDark} />;
        return <PostSearchCard item={item} isDark={isDark} />;
    };

    return (
        <SafeAreaView className={`flex-1 ${isDark ? "bg-[#050505]" : "bg-white"}`}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
            
            <View style={{ height: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }} />

            {/* Header / Search Bar */}
            <View className="px-4 py-3 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="pr-3">
                    <Ionicons name="chevron-back" size={32} color={isDark ? "white" : "black"} />
                </TouchableOpacity>
                <View className={`flex-1 flex-row items-center px-4 h-14 rounded-2xl border ${isDark ? 'bg-zinc-900 border-blue-900/30' : 'bg-gray-100 border-gray-200'}`}>
                    <Ionicons name="search" size={22} color="#3b82f6" />
                    <TextInput
                        placeholder="SCAN_DATA_STREAM..."
                        placeholderTextColor={isDark ? "#3f3f46" : "#a1a1aa"}
                        className={`flex-1 ml-3 font-bold text-sm tracking-widest ${isDark ? 'text-white' : 'text-black'}`}
                        value={query}
                        onChangeText={(t) => {
                            setQuery(t);
                            if (isOffline) setIsOffline(false);
                        }}
                        autoFocus
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={() => setQuery("")}>
                            <Ionicons name="close-circle" size={20} color={isDark ? "#52525b" : "#d1d5db"} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Main Content Area */}
            {query.length < 2 ? (
                <ScrollView className="flex-1 px-6">
                    <View className="mt-8">
                        <Text className="text-blue-500 font-black text-[10px] uppercase tracking-[0.4em] mb-6">Recent_Inquiries</Text>
                        {recentSearches.length > 0 ? (
                            recentSearches.map((s, i) => (
                                <TouchableOpacity key={i} onPress={() => setQuery(s)} className="flex-row items-center mb-6">
                                    <Ionicons name="refresh-circle-outline" size={20} color={isDark ? "#3f3f46" : "#d1d5db"} />
                                    <Text className={`${isDark ? 'text-zinc-400' : 'text-zinc-600'} ml-4 font-bold text-lg italic`}>{s}</Text>
                                    <Ionicons name="arrow-forward" size={14} color={isDark ? "#18181b" : "#f4f4f5"} className="ml-auto" />
                                </TouchableOpacity>
                            ))
                        ) : (
                            <Text className="text-zinc-400 italic text-sm mb-6">Clear history found.</Text>
                        )}

                        <Text className="text-purple-500 font-black text-[10px] uppercase tracking-[0.4em] mb-6 mt-4">Trending_Sectors</Text>
                        <View className="flex-row flex-wrap gap-2">
                            {trending.map((item, i) => (
                                <TouchableOpacity 
                                    key={i} 
                                    onPress={() => setQuery(item)}
                                    className={`${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-gray-100 border-gray-200'} border px-4 py-2 rounded-full`}
                                >
                                    <Text className={`${isDark ? 'text-zinc-400' : 'text-zinc-600'} font-bold text-xs uppercase italic`}># {item}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </ScrollView>
            ) : (
                <>
                    {/* Tabs Section */}
                    {!isOffline && (
                        <View className="flex-row px-4 py-3 gap-2">
                            {['all', 'authors', 'posts'].map((tab) => (
                                <TouchableOpacity
                                    key={tab}
                                    onPress={() => setActiveTab(tab)}
                                    className={`px-6 py-2 rounded-xl border ${activeTab === tab ? "bg-blue-600 border-blue-600 shadow-sm" : isDark ? "bg-transparent border-zinc-800" : "bg-gray-50 border-gray-200"}`}
                                >
                                    <Text className={`text-[10px] font-black uppercase tracking-widest ${activeTab === tab ? "text-white" : "text-zinc-500"}`}>{tab}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Search Results List */}
                    <View className="flex-1 px-4 mt-2">
                        {loading && page === 1 ? (
                            <View className="flex-1 justify-center items-center">
                                <ActivityIndicator color="#2563eb" size="large" />
                                <Text className="text-blue-500 text-[10px] font-black mt-6 tracking-[0.5em] uppercase animate-pulse">Establishing_Link...</Text>
                            </View>
                        ) : isOffline ? (
                            // 🔹 OFFLINE UI VERSION
                            <Animated.View entering={FadeIn.duration(400)} className="flex-1 items-center justify-center px-10">
                                <MaterialCommunityIcons name="wifi-strength-1-alert" size={80} color="#ef4444" className="opacity-50" />
                                <Text className="text-red-500 font-black text-xl italic uppercase tracking-tighter mt-4 text-center">Signal Interrupted</Text>
                                <Text className="text-zinc-500 text-center mt-2 mb-8 font-medium italic">
                                    The data stream is currently offline. Please check your neural connection.
                                </Text>
                                <TouchableOpacity 
                                    onPress={() => performSearch(query, 1, false)}
                                    className="bg-red-500/10 border border-red-500/20 px-8 py-3 rounded-full flex-row items-center gap-2"
                                >
                                    <Ionicons name="refresh" size={18} color="#ef4444" />
                                    <Text className="text-red-500 font-black uppercase tracking-widest text-xs">Retry Scan</Text>
                                </TouchableOpacity>
                            </Animated.View>
                        ) : (
                            <FlatList
                                data={[
                                    ...(activeTab === 'all' || activeTab === 'authors' ? results.authors : []),
                                    ...(activeTab === 'all' || activeTab === 'posts' ? results.posts : [])
                                ]}
                                keyExtractor={(item) => item._id}
                                renderItem={renderItem}
                                onEndReached={handleLoadMore}
                                onEndReachedThreshold={0.5}
                                ListFooterComponent={() => loadingMore ? (
                                    <View className="py-6">
                                        <ActivityIndicator color="#2563eb" />
                                    </View>
                                ) : null}
                                ListEmptyComponent={() => (
                                    <View className="mt-20 items-center opacity-40">
                                        <Ionicons name="scan-outline" size={80} color={isDark ? "#3f3f46" : "#d1d5db"} />
                                        <Text className="text-zinc-500 font-black mt-4 text-center tracking-widest uppercase text-xs">No matching frequencies detected.</Text>
                                    </View>
                                )}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingBottom: 60 }}
                            />
                        )}
                    </View>
                </>
            )}
        </SafeAreaView>
    );
};

export default SearchScreen;
