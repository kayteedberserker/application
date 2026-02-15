import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  DeviceEventEmitter,
  Dimensions,
  Easing,
  FlatList,
  Image,
  ScrollView,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AnimeLoading from "../../../components/AnimeLoading";
import PostCard from "../../../components/PostCard";
import { SyncLoading } from "../../../components/SyncLoading";
import { Text } from "../../../components/Text";
import apiFetch from "../../../utils/apiFetch";

const API_BASE = "https://oreblogda.com/api"
const { width } = Dimensions.get('window');

// 🧠 Tier 1: Memory Cache (Persistent while app is open)
const AUTHOR_MEMORY_CACHE = {};
const AUTHOR_POSTS_MEMORY_CACHE = {};

const getAuraTier = (rank) => {
  const MONARCH_GOLD = '#fbbf24';
  const CRIMSON_RED = '#ef4444';
  const SHADOW_PURPLE = '#a855f7';
  const STEEL_BLUE = '#3b82f6';
  const REI_WHITE = '#e0f2fe';

  if (!rank || rank > 10 || rank <= 0) {
    return { color: '#3b82f6', label: 'ACTIVE', icon: 'radar' };
  }

  switch (rank) {
    case 1: return { color: MONARCH_GOLD, label: 'MONARCH', icon: 'crown' };
    case 2: return { color: CRIMSON_RED, label: 'YONKO', icon: 'flare' };
    case 3: return { color: SHADOW_PURPLE, label: 'KAGE', icon: 'moon-waxing-crescent' };
    case 4: return { color: STEEL_BLUE, label: 'SHOGUN', icon: 'shield-star' };
    case 5: return { color: REI_WHITE, label: 'ESPADA 0', icon: 'skull' };
    case 6: return { color: '#cbd5e1', label: 'ESPADA 1', icon: 'sword-cross' };
    case 7: return { color: '#94a3b8', label: 'ESPADA 2', icon: 'sword-cross' };
    case 8: return { color: '#64748b', label: 'ESPADA 3', icon: 'sword-cross' };
    case 9: return { color: '#475569', label: 'ESPADA 4', icon: 'sword-cross' };
    case 10: return { color: '#334155', label: 'ESPADA 5', icon: 'sword-cross' };
    default: return { color: '#1e293b', label: 'VANGUARD', icon: 'shield-check' };
  }
};

export default function AuthorPage() {
  const { id } = useLocalSearchParams()
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const CACHE_KEY_AUTHOR = `author_data_${id}`;
  const CACHE_KEY_POSTS = `author_posts_${id}`;

  // 🔹 Init state from Memory Cache if available for instant UI
  const [author, setAuthor] = useState(AUTHOR_MEMORY_CACHE[CACHE_KEY_AUTHOR] || null)
  const [posts, setPosts] = useState(AUTHOR_POSTS_MEMORY_CACHE[CACHE_KEY_POSTS] || []);
  
  const [totalPosts, setTotalPosts] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isInitialMount, setIsInitialMount] = useState(true); 
  const { colorScheme } = useColorScheme()
  const isDark = colorScheme === "dark";

  const scrollRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const skeletonFade = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 2500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2500, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(rotationAnim, {
        toValue: 1,
        duration: 15000,
        easing: Easing.linear,
        useNativeDriver: true
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonFade, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(skeletonFade, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const spin = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("doScrollToTop", () => {
      scrollRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
    return () => sub.remove();
  }, []);

  // 🛡️ UPDATED: Generic save for Janitor compatibility
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

  const fetchInitialData = async () => {
    setLoading(true);
    setIsOffline(false);
    try {
      const [userRes, postRes] = await Promise.all([
        apiFetch(`${API_BASE}/users/${id}`),
        apiFetch(`/posts?author=${id}&page=1&limit=10`),
      ]);

      const userData = await userRes.json();
      const postData = await postRes.json();

      if (userRes.ok) {
        setAuthor(userData.user);
        // Save to Memory & Storage
        AUTHOR_MEMORY_CACHE[CACHE_KEY_AUTHOR] = userData.user;
        saveHeavyCache(CACHE_KEY_AUTHOR, userData.user);
      }
      if (postRes.ok) {
        setPosts(postData.posts);
        setTotalPosts(postData.total || postData.posts.length);
        setHasMore(postData.posts.length >= 6);
        
        // Save to Memory & Storage
        AUTHOR_POSTS_MEMORY_CACHE[CACHE_KEY_POSTS] = postData.posts;
        saveHeavyCache(CACHE_KEY_POSTS, postData.posts);
      }
    } catch (error) {
      console.error("Fetch error:", error);
      setIsOffline(true);
    } finally {
      setLoading(false);
      setTimeout(() => setIsInitialMount(false), 800);
    }
  };

  const fetchMorePosts = async () => {
    if (!hasMore || loading || posts.length === 0 || isOffline) return;
    const nextPage = page + 1;
    setLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/posts?author=${id}&page=${nextPage}&limit=10`);
      const data = await res.json();
      if (res.ok && data.posts.length > 0) {
        setPosts((prev) => {
            const updated = [...prev, ...data.posts];
            AUTHOR_POSTS_MEMORY_CACHE[CACHE_KEY_POSTS] = updated; // Update memory on pagination
            return updated;
        });
        setTotalPosts(data.total);
        setPage(nextPage);
        setHasMore(data.posts.length >= 6);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Load more error:", error);
    } finally {
      setLoading(false);
    }
  };

  // ⚡ HYBRID LOGIC: Memory -> Storage -> API Revalidate
  useEffect(() => {
    const init = async () => {
      // 1. Check Memory first
      if (AUTHOR_MEMORY_CACHE[CACHE_KEY_AUTHOR]) {
        setIsInitialMount(false); // Memory exists, skip full screen loading
        fetchInitialData(); // Revalidate background
        return;
      }

      // 2. Check AsyncStorage
      try {
        const [cAuth, cPosts] = await Promise.all([
          AsyncStorage.getItem(CACHE_KEY_AUTHOR),
          AsyncStorage.getItem(CACHE_KEY_POSTS)
        ]);

        if (cAuth) {
          const parsed = JSON.parse(cAuth);
          const authorData = parsed?.data || parsed;
          setAuthor(authorData);
          AUTHOR_MEMORY_CACHE[CACHE_KEY_AUTHOR] = authorData;
        }

        if (cPosts) {
          const parsed = JSON.parse(cPosts);
          const postData = parsed?.data || parsed;
          setPosts(postData);
          AUTHOR_POSTS_MEMORY_CACHE[CACHE_KEY_POSTS] = postData;
          setIsInitialMount(false); // We have content, don't show AnimeLoading
        }

        // 3. Revalidate from API regardless
        fetchInitialData();
      } catch (e) { 
        fetchInitialData(); 
      }
    };
    init();
  }, [id]);

  const AuthorSkeleton = () => (
    <View className="px-4 pt-20 pb-6 opacity-40">
      <View className="p-6 bg-gray-100 dark:bg-[#111] border border-gray-200 dark:border-gray-800 rounded-[40px] items-center">
        <Animated.View style={{ opacity: skeletonFade }} className="w-32 h-32 bg-gray-300 dark:bg-gray-800 rounded-full mb-6" />
        <Animated.View style={{ opacity: skeletonFade }} className="w-48 h-8 bg-gray-300 dark:bg-gray-800 rounded-lg mb-4" />
        <Animated.View style={{ opacity: skeletonFade }} className="w-full h-4 bg-gray-300 dark:bg-gray-800 rounded-lg mb-2" />
        <Animated.View style={{ opacity: skeletonFade }} className="w-2/3 h-4 bg-gray-300 dark:bg-gray-800 rounded-lg" />
        <View className="flex-row gap-8 mt-10 w-full py-4 justify-center border-y border-gray-200 dark:border-gray-800">
          {[1, 2, 3].map(i => <View key={i} className="w-12 h-10 bg-gray-300 dark:bg-gray-800 rounded" />)}
        </View>
      </View>
    </View>
  );

  const ListHeader = () => {
    if (!author && isOffline) return <AuthorSkeleton />;
    if (!author) return null;

    const count = totalPosts;
    const rankTitle = count > 200 ? "Master_Writer" : count > 150 ? "Elite_Writer" : count > 100 ? "Senior_Writer" : count > 50 ? "Novice_Writer" : count > 25 ? "Senior_Researcher" : "Novice_Researcher";
    const rankIcon = count > 200 ? "👑" : count > 150 ? "💎" : count > 100 ? "🔥" : count > 50 ? "⚔️" : count > 25 ? "📜" : "🛡️";
    const nextMilestone = count > 200 ? 500 : count > 150 ? 200 : count > 100 ? 150 : count > 50 ? 100 : count > 25 ? 50 : 25;
    const progress = Math.min((count / nextMilestone) * 100, 100);

    const auraRank = author?.previousRank || 0;
    const aura = getAuraTier(auraRank);

    const getBadgeStyle = () => {
      if (auraRank === 1) return { borderRadius: 45, transform: [{ rotate: '45deg' }] };
      if (auraRank === 2) return { borderRadius: 60 };
      if (auraRank === 3) return { borderRadius: 35 };
      return { borderRadius: 100 };
    };

    return (
      <View className="px-4 pt-20 pb-6">
        {author && (
          <View
            className="relative p-6 bg-white dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-800 overflow-hidden shadow-2xl"
            style={{ borderRadius: 40 }}
          >
            <View
              className="absolute -top-10 -right-10 w-60 h-60 opacity-10 rounded-full blur-3xl"
              style={{ backgroundColor: aura.color }}
            />

            <View className="flex-col items-center gap-6">
              <View className="relative items-center justify-center">

                {auraRank > 0 && auraRank <= 5 && (
                  <Animated.View
                    style={[
                      getBadgeStyle(),
                      {
                        position: 'absolute',
                        width: 170,
                        height: 170,
                        borderWidth: 1,
                        borderColor: aura.color,
                        borderStyle: 'dashed',
                        transform: [...getBadgeStyle().transform || [], { rotate: spin }]
                      }
                    ]}
                  />
                )}

                {auraRank > 0 && (
                  <Animated.View
                    style={[
                      getBadgeStyle(),
                      {
                        position: 'absolute',
                        width: 155,
                        height: 155,
                        borderWidth: 3,
                        borderColor: aura.color,
                        borderStyle: auraRank <= 3 ? 'solid' : 'dashed',
                        opacity: 0.4,
                        transform: [...getBadgeStyle().transform || [], { scale: pulseAnim }]
                      }
                    ]}
                  />
                )}

                <View
                  style={[getBadgeStyle(), { overflow: 'hidden', borderWidth: 4, borderColor: auraRank > 0 ? aura.color : '#eee' }]}
                  className="w-32 h-32 bg-gray-900"
                >
                  <Image
                    source={{ uri: author.profilePic?.url || "https://via.placeholder.com/150" }}
                    style={{ width: '110%', height: '110%', transform: auraRank === 1 ? [{ rotate: '-45deg' }] : [] }}
                  />
                </View>

                {auraRank > 0 && (
                  <View
                    style={{ backgroundColor: aura.color }}
                    className="absolute -bottom-3 px-4 py-1 rounded-full border-2 border-white dark:border-black shadow-lg"
                  >
                    <View className="flex-row items-center gap-1">
                      <MaterialCommunityIcons name={aura.icon} size={10} color={auraRank === 5 ? "black" : "white"} />
                      <Text
                        style={{ color: auraRank === 5 ? "black" : "white" }}
                        className="text-[9px] font-black uppercase tracking-widest"
                      >
                        {aura.label} #{auraRank}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              <View className="items-center w-full mt-2">
                <View className="flex-row items-center gap-2 mb-2">
                  <Text
                    style={{ textShadowColor: aura.color, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: auraRank <= 2 ? 10 : 0 }}
                    className="text-4xl font-black italic tracking-tighter uppercase text-gray-900 dark:text-white text-center"
                  >
                    {author.username}
                  </Text>
                  <View className="flex-row items-center bg-orange-500/10 px-2 py-1 rounded-lg">
                    <Ionicons name="flame" size={16} color="#f97316" />
                    <Text className="text-orange-500 font-black ml-1 text-xs">{author.lastStreak || "0"}</Text>
                  </View>
                </View>

                <Text className="text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed font-medium px-8 italic">
                  "{author.description || "This operator is a ghost in the machine..."}"
                </Text>

                <View className="flex-row gap-8 mt-6 border-y border-gray-100 dark:border-gray-800 w-full py-4 justify-center">
                  <View className="items-center">
                    <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Aura</Text>
                    <Text className="text-lg font-black" style={{ color: aura.color }}>+{author.weeklyAura || 0}</Text>
                  </View>
                  <View className="items-center">
                    <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Logs</Text>
                    <Text className="text-lg font-black dark:text-white">{totalPosts}</Text>
                  </View>
                  <View className="items-center">
                    <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rank</Text>
                    <Text className="text-lg font-black dark:text-white" style={{ color: auraRank > 0 ? aura.color : undefined }}>#{auraRank || '??'}</Text>
                  </View>
                </View>

                <View className="mt-8 w-full px-2">
                  <View className="flex-row justify-between items-end mb-2">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-2xl">{rankIcon}</Text>
                      <View>
                        <Text style={{ color: aura.color }} className="text-[8px] font-mono uppercase tracking-[0.2em] leading-none mb-1">Writer_Class</Text>
                        <Text className="text-sm font-black uppercase tracking-tighter dark:text-white">
                          {rankTitle}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-[10px] font-mono font-bold text-gray-500 uppercase">
                      EXP: {count} / {nextMilestone}
                    </Text>
                  </View>

                  <View className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <View
                      style={{ width: `${progress}%`, backgroundColor: aura.color }}
                      className="h-full shadow-lg shadow-blue-500"
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}

        <View className="flex-row items-center gap-4 mt-10 mb-4 px-2">
          <Text className="text-xl font-black italic uppercase tracking-tighter text-gray-900 dark:text-white">
            Diary<Text style={{ color: aura ? aura.color : '#3b82f6' }}> Archives </Text>
          </Text>
          <View className="h-[1px] flex-1 bg-gray-100 dark:bg-gray-800" />
        </View>
      </View>
    );
  };

  const renderItem = ({ item, index }) => {
    const showAd = (index + 1) % 4 === 0;
    return (
      <View className={'px-3'}>
        <PostCard post={item} isFeed />
        {/* {showAd && (
          <View className="mb-3 mt-3 w-full p-6 border border-dashed border-gray-300 dark:border-gray-800 rounded-[32px] bg-gray-50/50 dark:bg-white/5 items-center justify-center">
							<Text className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] italic text-center">Sponsored Transmission</Text>
							<AppBanner size="MEDIUM_RECTANGLE" />
						</View>
        )} */}
      </View>
    );
  };

  if (!author && isOffline) {
    return (
      <ScrollView
        className="flex-1 bg-white dark:bg-[#0a0a0a]"
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        <AuthorSkeleton />
        <View className="items-center justify-center px-10 -mt-10">
          <MaterialCommunityIcons name="wifi-strength-1-alert" size={48} color="#ef4444" />
          <Text className="text-2xl font-black uppercase italic text-red-600 mt-4">Signal Interrupted</Text>
          <Text className="text-center text-gray-500 dark:text-gray-400 mt-2 mb-8 font-medium">
            Neural link to the central database has been severed. Showing cached records.
          </Text>
          <TouchableOpacity
            onPress={fetchInitialData}
            className="bg-red-600 px-8 py-3 rounded-full flex-row items-center gap-2 shadow-lg"
          >
            <Ionicons name="refresh" size={18} color="white" />
            <Text className="text-white font-black uppercase tracking-widest text-xs">Reconnect</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} className="mt-6">
            <Text className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Return to Base</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (isInitialMount && posts.length === 0 && !author) {
    return <AnimeLoading message="Loading Author" subMessage="Decoding biological data..." />;
  }

  return (
    <FlatList
      ref={scrollRef}
      data={posts}
      keyExtractor={(item) => item._id}
      renderItem={renderItem}
      ListHeaderComponent={ListHeader}
      ListFooterComponent={
        <View className="py-10">
          {loading && <SyncLoading />}
          {!hasMore && posts.length > 0 && (
            <View className="items-center opacity-30">
              <View className="h-[1px] w-24 bg-gray-500 mb-4" />
              <Text className="text-[10px] font-mono uppercase tracking-[0.4em] dark:text-white">End_Of_Transmission</Text>
            </View>
          )}
        </View>
      }
      onEndReached={fetchMorePosts}
      onEndReachedThreshold={0.5}
      onRefresh={() => { setPage(1); fetchInitialData(); }}
      refreshing={refreshing}
      onScroll={(e) => { DeviceEventEmitter.emit("onScroll", e.nativeEvent.contentOffset.y); }}
      scrollEventThrottle={16}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      className="bg-white dark:bg-[#0a0a0a]"
    />
  );
}