import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  DeviceEventEmitter,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Modal,
  ScrollView,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AnimeLoading from "../../../components/AnimeLoading";
import ClanCrest from "../../../components/ClanCrest";
import PostCard from "../../../components/PostCard";
import { SyncLoading } from "../../../components/SyncLoading";
import { Text } from "../../../components/Text";
import { useUser } from "../../../context/UserContext";
import apiFetch from "../../../utils/apiFetch";

const API_BASE = "https://oreblogda.com/api";
const { width } = Dimensions.get('window');
const APP_BLUE = "#3b82f6";

// 🧠 Tier 1: Memory Cache (Persistent while app is open)
const CLAN_MEMORY_CACHE = {};
const CLAN_POSTS_MEMORY_CACHE = {};

// 🔹 CUSTOM ALERT COMPONENT
const CustomAlert = ({ config, onClose, isDark }) => {
  if (!config.visible) return null;
  return (
    <Modal transparent animationType="fade" visible={config.visible}>
      <View className="flex-1 justify-center items-center bg-black/80 px-10">
        <View className={`w-full p-8 rounded-[35px] border ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"}`}>
          <View className="items-center mb-6">
            <View className={`w-14 h-14 rounded-full items-center justify-center mb-4 ${config.type === 'error' ? 'bg-blue-500/10' : 'bg-emerald-500/10'}`}>
              <Ionicons name={config.type === 'error' ? "alert-circle" : "checkmark-circle"} size={32} color={config.type === 'error' ? "#2563eb" : "#10b981"} />
            </View>
            <Text className={`text-xl font-black text-center ${isDark ? "text-white" : "text-zinc-900"}`}>{config.title}</Text>
            <Text className={`text-sm font-medium text-center mt-2 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{config.message}</Text>
          </View>
          <TouchableOpacity onPress={onClose} className="bg-zinc-800 p-5 rounded-[20px] items-center">
            <Text className="text-white font-black uppercase tracking-widest text-[12px]">Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// 🔹 CLAN RANK LOGIC
const getClanTierDetails = (title) => {
  switch (title) {
    case "The Akatsuki": return { rank: 6, color: '#ef4444' };
    case "The Espada": return { rank: 5, color: '#e0f2fe' };
    case "Phantom Troupe": return { rank: 4, color: '#a855f7' };
    case "Upper Moon": return { rank: 3, color: '#60a5fa' };
    case "Squad 13": return { rank: 2, color: '#10b981' };
    default: return { rank: 1, color: '#94a3b8' };
  }
};

export default function ClanPage() {
  const { tag } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useUser();
  const insets = useSafeAreaInsets();

  const CACHE_KEY_CLAN = `clan_data_${tag}`;
  const CACHE_KEY_POSTS = `clan_posts_${tag}`;

  // 🔹 Init state from Memory Cache if available for instant UI
  const [clan, setClan] = useState(CLAN_MEMORY_CACHE[CACHE_KEY_CLAN] || null);
  const [posts, setPosts] = useState(CLAN_POSTS_MEMORY_CACHE[CACHE_KEY_POSTS] || []);

  const [totalPosts, setTotalPosts] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isInitialMount, setIsInitialMount] = useState(true);

  // Follow States
  const [isFollowing, setIsFollowing] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Alert State
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: "", message: "", type: "success" });

  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const scrollRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const skeletonFade = useRef(new Animated.Value(0.3)).current;

  const showAlert = (title, message, type = "error") => {
    setAlertConfig({ visible: true, title, message, type });
  };

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(rotationAnim, {
        toValue: 1,
        duration: 20000,
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

  // 🛡️ Janitor compatibility: Save with timestamp
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

  // 🔹 SYNC FOLLOW STATUS
  useEffect(() => {
    const checkFollowStatus = async () => {
      try {
        const followedClans = await AsyncStorage.getItem('followed_clans');
        const clanList = followedClans ? JSON.parse(followedClans) : [];
        if (clanList.includes(tag)) {
          setIsFollowing(true);
        }
      } catch (e) {
        console.error("Follow status check error", e);
      }
    };
    checkFollowStatus();
  }, [tag]);

  const fetchInitialData = async () => {
    setLoading(true);
    setIsOffline(false);
    try {
      const [clanRes, postRes] = await Promise.all([
        apiFetch(`/clans/${tag}?deviceId=${user?.deviceId}`),
        apiFetch(`/posts?clanId=${tag}&page=1&limit=10`),
      ]);

      const clanData = await clanRes.json();
      const postData = await postRes.json();

      if (clanRes.ok) {
        setClan(clanData);
        // Save to Memory & Storage
        CLAN_MEMORY_CACHE[CACHE_KEY_CLAN] = clanData;
        saveHeavyCache(CACHE_KEY_CLAN, clanData);
      }
      if (postRes.ok) {
        setPosts(postData.posts);
        setTotalPosts(postData.total || postData.posts.length);
        setHasMore(postData.posts.length >= 6);

        // Save to Memory & Storage
        CLAN_POSTS_MEMORY_CACHE[CACHE_KEY_POSTS] = postData.posts;
        saveHeavyCache(CACHE_KEY_POSTS, postData.posts);
      }
    } catch (error) {
      console.error("Fetch error:", error);
      setIsOffline(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setTimeout(() => setIsInitialMount(false), 800);
    }
  };

  const fetchMorePosts = async () => {
    if (!hasMore || loading || posts.length === 0 || isOffline) return;
    const nextPage = page + 1;
    setLoading(true);
    try {
      const res = await apiFetch(`/posts?clanId=${tag}&page=${nextPage}&limit=10`);
      const data = await res.json();
      if (res.ok && data.posts.length > 0) {
        setPosts((prev) => {
          const updated = [...prev, ...data.posts];
          CLAN_POSTS_MEMORY_CACHE[CACHE_KEY_POSTS] = updated; // Update memory on pagination
          return updated;
        });
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
      if (CLAN_MEMORY_CACHE[CACHE_KEY_CLAN]) {
        setIsInitialMount(false);
        fetchInitialData(); // Revalidate background
        return;
      }

      // 2. Check AsyncStorage
      try {
        const [cClan, cPosts] = await Promise.all([
          AsyncStorage.getItem(CACHE_KEY_CLAN),
          AsyncStorage.getItem(CACHE_KEY_POSTS)
        ]);

        if (cClan) {
          const parsed = JSON.parse(cClan);
          const clanData = parsed?.data || parsed;
          setClan(clanData);
          CLAN_MEMORY_CACHE[CACHE_KEY_CLAN] = clanData;
        }

        if (cPosts) {
          const parsed = JSON.parse(cPosts);
          const postData = parsed?.data || parsed;
          setPosts(postData);
          CLAN_POSTS_MEMORY_CACHE[CACHE_KEY_POSTS] = postData;
          setIsInitialMount(false); // We have content, don't show AnimeLoading
        }

        // 3. Revalidate from API
        fetchInitialData();
      } catch (e) {
        fetchInitialData();
      }
    };
    init();
  }, [tag, user?.deviceId]);

  // 🔹 UPDATED FOLLOW LOGIC (Supports Unfollow)
  const handleFollow = async () => {
    if (!user) {
      showAlert("AUTHENTICATION", "Please log in to interact with clans.");
      return;
    }

    setLoadingFollow(true);
    const action = isFollowing ? "unfollow" : "follow";

    try {
      const res = await apiFetch(`/clans/follow`, {
        method: "POST",
        body: JSON.stringify({ clanTag: tag, deviceId: user.deviceId, action: action })
      });

      if (res.ok) {
        const followedClans = await AsyncStorage.getItem('followed_clans');
        let clanList = followedClans ? JSON.parse(followedClans) : [];

        if (action === "follow") {
          setIsFollowing(true);
          if (!clanList.includes(tag)) clanList.push(tag);
          showAlert("CLAN JOINED", `You are now following ${clan?.name || 'this clan'}.`, "success");
        } else {
          setIsFollowing(false);
          clanList = clanList.filter(t => t !== tag);
          showAlert("UNFOLLOWED", `You have left ${clan?.name || 'this clan'}.`, "success");
        }

        await AsyncStorage.setItem('followed_clans', JSON.stringify(clanList));
      } else {
        const data = await res.json();
        showAlert("ACTION FAILED", data.message || "Could not update follow status.");
      }
    } catch (err) {
      console.error("Follow Clan err", err);
      showAlert("CONNECTION ERROR", "Check your internet connection.");
    } finally {
      setLoadingFollow(false);
    }
  };

  // 🔹 APPLY AS AUTHOR LOGIC
  const handleAuthorRequest = async () => {
    if (!user) {
      showAlert("AUTHENTICATION", "Login required to apply.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiFetch(`/clans/${tag}/join`, {
        method: "POST",
        body: JSON.stringify({ deviceId: user.deviceId, username: user.username })
      });
      const data = await res.json();
      if (res.ok) {
        showAlert("REQUEST SENT", "Your application is under review by the clan leader.", "success");
      } else {
        showAlert("REQUEST FAILED", data.message || "Requirement not met.");
      }
    } catch (err) {
      showAlert("CONNECTION ERROR", "Backend is not responding.");
    } finally {
      setActionLoading(false);
    }
  };

  const ClanSkeleton = () => (
    <View className="px-4 pt-20 pb-6 opacity-40">
      <View className="p-6 bg-gray-100 dark:bg-[#111] border border-gray-200 dark:border-gray-800 rounded-[40px] items-center">
        <Animated.View style={{ opacity: skeletonFade }} className="w-32 h-32 bg-gray-300 dark:bg-gray-800 rounded-full mb-6" />
        <Animated.View style={{ opacity: skeletonFade }} className="w-48 h-8 bg-gray-300 dark:bg-gray-800 rounded-lg mb-4" />
      </View>
    </View>
  );

  const ListHeader = () => {
    if (!clan && isOffline) return <ClanSkeleton />;
    if (!clan) return null;

    const rankInfo = getClanTierDetails(clan.rankTitle || "Wandering Ronin");
    const nextMilestone = clan.nextThreshold || 5000;
    const currentPoints = clan.totalPoints || 0;
    const progress = Math.min((currentPoints / nextMilestone) * 100, 100);

    return (
      <View className="px-4 pt-16 pb-4">
        <View className="relative p-5 bg-white dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-800 shadow-2xl rounded-[35px] overflow-hidden">

          {/* Background Glow */}
          <View className="absolute -top-10 -right-10 w-40 h-40 opacity-10 rounded-full blur-3xl" style={{ backgroundColor: rankInfo.color }} />

          <View className="items-center">
            {/* 🔹 CLAN CREST SECTION */}
            <View className="relative items-center justify-center mb-4">
              <Animated.View
                style={{
                  position: 'absolute', width: 120, height: 120, borderRadius: 100,
                  backgroundColor: rankInfo.color, opacity: 0.1,
                  transform: [{ scale: pulseAnim }]
                }}
              />
              <Animated.View
                style={{ transform: [{ rotate: spin }], borderColor: `${rankInfo.color}40`, width: 140, height: 140 }}
                className="absolute border border-dashed rounded-full"
              />
              <ClanCrest rank={clan.rank || 1} size={110} />
            </View>

            {/* Clan Title & Follow Button */}
            <View className="flex-row items-center gap-3">
              <Text className="text-2xl font-black italic uppercase tracking-tighter dark:text-white">
                {clan.name}
              </Text>
              <TouchableOpacity
                onPress={handleFollow}
                disabled={loadingFollow}
                className={`px-4 py-1.5 rounded-full border flex-row items-center gap-2 ${isFollowing ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-transparent' : 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-500/40'}`}
              >
                {loadingFollow ? (
                  <ActivityIndicator size="small" color={isFollowing ? "#3b82f6" : "white"} />
                ) : (
                  <>
                    {isFollowing && <Feather name="check" size={12} color={isDark ? "#9ca3af" : "#4b5563"} />}
                    <Text className={`text-[10px] font-black uppercase ${isFollowing ? 'text-gray-500 dark:text-gray-400' : 'text-white'}`}>
                      {isFollowing ? 'Joined' : 'Follow'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <Text className="text-[10px] font-bold text-blue-500 tracking-widest uppercase mt-0.5">#{clan.tag}</Text>

            <Text className="text-xs text-gray-500 dark:text-gray-400 text-center italic mt-2 px-6" numberOfLines={2}>
              "{clan.description || "A gathering of warriors with no code..."}"
            </Text>

            {/* 🔹 STATS ROW */}
            <View className="flex-row gap-6 mt-4 w-full justify-center border-y border-gray-50 dark:border-gray-900/50 py-3">
              <View className="items-center">
                <Text className="text-[9px] font-black text-gray-400 uppercase">Followers</Text>
                <Text className="text-sm font-black dark:text-white">{clan.followerCount?.toLocaleString() || 0}</Text>
              </View>
              <View className="items-center">
                <Text className="text-[9px] font-black text-gray-400 uppercase">Points</Text>
                <Text className="text-sm font-black" style={{ color: rankInfo.color }}>{currentPoints.toLocaleString()}</Text>
              </View>
              <View className="items-center">
                <Text className="text-[9px] font-black text-gray-400 uppercase">Badges</Text>
                <Text className="text-sm font-black dark:text-white">{clan.badges?.length || 0}</Text>
              </View>
              <View className="items-center">
                <Text className="text-[9px] font-black text-gray-400 uppercase">Members</Text>
                <Text className="text-sm font-black dark:text-white">{clan.members?.length || 0}/{clan.maxSlots || 5}</Text>
              </View>
            </View>

            {/* 🔹 BADGES */}
            {clan.badges?.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3" contentContainerStyle={{ gap: 8, paddingHorizontal: 10 }}>
                {clan.badges.map((badge, idx) => (
                  <View key={idx} className="bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded-md border border-gray-100 dark:border-gray-800 flex-row items-center gap-1">
                    <MaterialCommunityIcons name="seal-variant" size={12} color={rankInfo.color} />
                    <Text className="text-[8px] font-black dark:text-gray-300 uppercase">{badge}</Text>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Leadership & Apply Button */}
            <View className="flex-row items-center justify-between w-full mt-4 px-2">
              <View className="flex-row gap-2">
                {clan.leader && (
                  <TouchableOpacity onPress={() => router.push(`/author/${clan.leader._id}`)} className="flex-row items-center gap-1.5 bg-gray-50 dark:bg-gray-900 p-1 pr-2 rounded-full border border-gray-100 dark:border-gray-800">
                    <Image source={{ uri: clan.leader.profilePic?.url || "https://via.placeholder.com/150" }} className="w-6 h-6 rounded-full" />
                    <Text className="text-[9px] font-bold dark:text-white">{clan.leader.username}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {clan.isRecruiting && (
                <TouchableOpacity
                  onPress={handleAuthorRequest}
                  disabled={actionLoading}
                  className="bg-green-500/10 border border-green-500/20 px-4 py-1.5 rounded-full flex-row items-center gap-2"
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#22c55e" />
                  ) : (
                    <Text className="text-green-500 text-[10px] font-black uppercase tracking-tighter">Apply as Author</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Progress Bar */}
            <View className="mt-5 w-full">
              <View className="flex-row justify-between mb-1 px-1">
                <Text className="text-[8px] font-black text-gray-400 uppercase">{clan.rankTitle}</Text>
                <Text className="text-[8px] font-mono text-gray-400">{currentPoints} / {nextMilestone}</Text>
              </View>
              <View className="h-1 w-full bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                <View style={{ width: `${progress}%`, backgroundColor: rankInfo.color }} className="h-full" />
              </View>
            </View>
          </View>
        </View>

        {/* Section Title */}
        <View className="flex-row items-center gap-4 mt-8 mb-2 px-2">
          <Text className="text-lg font-black italic uppercase tracking-tighter text-gray-900 dark:text-white">
            Clan<Text style={{ color: rankInfo.color }}> Transmissions </Text>
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
        {showAd && <View className="mb-3 mt-3 w-full p-6 border border-dashed border-gray-300 dark:border-gray-800 rounded-[32px] bg-gray-50/50 dark:bg-white/5 items-center justify-center">
							<Text className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] italic text-center">Sponsored Transmission</Text>
							{/* <AppBanner size="MEDIUM_RECTANGLE" /> */}
						</View>}
      </View>
    );
  };

  if (!clan && isOffline) {
    return (
      <ScrollView className="flex-1 bg-white dark:bg-[#0a0a0a]" contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <ClanSkeleton />
        <View className="items-center justify-center px-10 -mt-10">
          <MaterialCommunityIcons name="wifi-strength-1-alert" size={48} color="#ef4444" />
          <Text className="text-2xl font-black uppercase italic text-red-600 mt-4">Signal Interrupted</Text>
          <TouchableOpacity onPress={fetchInitialData} className="bg-red-600 px-8 py-3 rounded-full mt-6 shadow-lg">
            <Text className="text-white font-black uppercase tracking-widest text-xs">Reconnect</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (isInitialMount && posts.length === 0 && !clan) {
    return <AnimeLoading message="Loading Clan" subMessage="Decrypting organization files..." />;
  }

  return (
    <View className="flex-1 bg-white dark:bg-[#0a0a0a]">
      <CustomAlert
        config={alertConfig}
        onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
        isDark={isDark}
      />

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
    </View>
  );
}