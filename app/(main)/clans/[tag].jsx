import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useColorScheme } from "nativewind";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Clipboard,
  DeviceEventEmitter,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop, SvgXml } from "react-native-svg";
import ViewShot from "react-native-view-shot";
import { ClanBadge } from "../../../components/ClanBadge";
import ClanBorder from "../../../components/ClanBorder";
import ClanCard from "../../../components/ClanCard";
import ClanCrest from "../../../components/ClanCrest";
import PostCard from "../../../components/PostCard";
import { SyncLoading } from "../../../components/SyncLoading";
import { Text } from "../../../components/Text";
import { useAlert } from "../../../context/AlertContext";
import { useUser } from "../../../context/UserContext";
import apiFetch from "../../../utils/apiFetch";

const API_BASE = "https://oreblogda.com/api";
const { width } = Dimensions.get('window');

const CLAN_MEMORY_CACHE = {};
const CLAN_POSTS_MEMORY_CACHE = {};

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
  const showAlert = useAlert();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const CACHE_KEY_CLAN = `clan_data_${tag}`;
  const CACHE_KEY_POSTS = `clan_posts_${tag}`;

  const [clan, setClan] = useState(CLAN_MEMORY_CACHE[CACHE_KEY_CLAN] || null);
  const [posts, setPosts] = useState(CLAN_POSTS_MEMORY_CACHE[CACHE_KEY_POSTS] || []);
  const [totalPosts, setTotalPosts] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isInitialMount, setIsInitialMount] = useState(true);
  const [cardPreviewVisible, setCardPreviewVisible] = useState(false);

  const [isFollowing, setIsFollowing] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const scrollRef = useRef(null);
  const clanCardRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const skeletonFade = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(rotationAnim, { toValue: 1, duration: 20000, easing: Easing.linear, useNativeDriver: true })
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

  const saveHeavyCache = async (key, data) => {
    try {
      const cacheEntry = { data: data, timestamp: Date.now() };
      await AsyncStorage.setItem(key, JSON.stringify(cacheEntry));
    } catch (e) { console.error("Cache Save Error", e); }
  };

  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!user) return;
      try {
        const followedClansStr = await AsyncStorage.getItem('followed_clans');
        const checkedClansStr = await AsyncStorage.getItem('checked_clans');
        let followedClans = followedClansStr ? JSON.parse(followedClansStr) : [];
        let checkedClans = checkedClansStr ? JSON.parse(checkedClansStr) : [];

        if (followedClans.includes(tag)) { setIsFollowing(true); return; }
        if (checkedClans.includes(tag)) { setIsFollowing(false); return; }

        const res = await apiFetch(`/clans/follow/status?clanTag=${tag}&deviceId=${user.deviceId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.isFollowing) {
            setIsFollowing(true);
            followedClans.push(tag);
            await AsyncStorage.setItem('followed_clans', JSON.stringify(followedClans));
          } else {
            setIsFollowing(false);
            checkedClans.push(tag);
            await AsyncStorage.setItem('checked_clans', JSON.stringify(checkedClans));
          }
        }
      } catch (e) { console.error("Follow status sync error", e); }
    };
    checkFollowStatus();
  }, [tag, user]);

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
        CLAN_MEMORY_CACHE[CACHE_KEY_CLAN] = clanData;
        saveHeavyCache(CACHE_KEY_CLAN, clanData);
      }
      if (postRes.ok) {
        setPosts(postData.posts);
        setTotalPosts(postData.total || postData.posts.length);
        setHasMore(postData.posts.length >= 6);
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
          CLAN_POSTS_MEMORY_CACHE[CACHE_KEY_POSTS] = updated;
          return updated;
        });
        setPage(nextPage);
        setHasMore(data.posts.length >= 6);
      } else { setHasMore(false); }
    } catch (error) { console.error("Load more error:", error); } finally { setLoading(false); }
  };

  useEffect(() => {
    const init = async () => {
      if (CLAN_MEMORY_CACHE[CACHE_KEY_CLAN]) {
        setIsInitialMount(false);
        fetchInitialData();
        return;
      }
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
          setIsInitialMount(false);
        }
        fetchInitialData();
      } catch (e) { fetchInitialData(); }
    };
    init();
  }, [tag, user?.deviceId]);

  const performFollowAction = async (action) => {
    setLoadingFollow(true);
    try {
      const res = await apiFetch(`/clans/follow`, {
        method: "POST",
        body: JSON.stringify({ clanTag: tag, deviceId: user.deviceId, action: action })
      });
      if (res.ok) {
        const followedClansStr = await AsyncStorage.getItem('followed_clans');
        const checkedClansStr = await AsyncStorage.getItem('checked_clans');
        let clanList = followedClansStr ? JSON.parse(followedClansStr) : [];
        let checkedList = checkedClansStr ? JSON.parse(checkedClansStr) : [];

        if (action === "follow") {
          setIsFollowing(true);
          if (!clanList.includes(tag)) clanList.push(tag);
          checkedList = checkedList.filter(t => t !== tag);
          showAlert("CLAN JOINED", `You are now following ${clan?.name}.`);
        } else {
          setIsFollowing(false);
          clanList = clanList.filter(t => t !== tag);
          if (!checkedList.includes(tag)) checkedList.push(tag);
          showAlert("UNFOLLOWED", `You have left ${clan?.name}.`);
        }
        await AsyncStorage.setItem('followed_clans', JSON.stringify(clanList));
        await AsyncStorage.setItem('checked_clans', JSON.stringify(checkedList));
      }
    } catch (err) { showAlert("CONNECTION ERROR", "Check your internet connection."); } finally { setLoadingFollow(false); }
  };

  const handleFollow = async () => {
    if (!user) { showAlert("AUTHENTICATION", "Log in to interact."); return; }
    if (isFollowing) {
      showAlert("LEAVE CLAN?", `Unfollow ${clan?.name}?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Unfollow", style: "destructive", onPress: () => performFollowAction("unfollow") }
      ]);
      return;
    }
    performFollowAction("follow");
  };

  const handleAuthorRequest = async () => {
    if (!user) { showAlert("AUTHENTICATION", "Login required."); return; }
    setActionLoading(true);
    try {
      const res = await apiFetch(`/clans/${tag}/join`, {
        method: "POST",
        body: JSON.stringify({ deviceId: user.deviceId, username: user.username })
      });
      if (res.ok) { showAlert("REQUEST SENT", "Review pending by leader."); }
      else { showAlert("REQUEST FAILED", "Requirement not met."); }
    } catch (err) { showAlert("CONNECTION ERROR", "Backend error."); } finally { setActionLoading(false); }
  };

  const captureAndShare = async () => {
    try {
      if (clanCardRef.current) {
        const uri = await clanCardRef.current.capture();
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri);
        }
      }
    } catch (error) { console.error("Capture Error:", error); }
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
    const nextMilestone = clan.nextThreshold || 5000;
    const currentPoints = clan.totalPoints || 0;
    const progress = Math.min((currentPoints / nextMilestone) * 100, 100);
    const isVerified = clan.verifiedUntil && new Date(clan.verifiedUntil) > new Date();
    const rankInfo = getClanTierDetails(clan.rankTitle || "Wandering Ronin");
    const highlightColor = isVerified ? "#fbbf24" : (rankInfo.color || THEME.accent);

    const equippedGlow = clan.specialInventory?.find(i => i.category === 'GLOW' && i.isEquipped);
    const activeGlowColor = equippedGlow?.visualConfig?.primaryColor || equippedGlow?.visualData?.glowColor || null;

    const equippedBg = clan.specialInventory?.find(i => i.category === 'BACKGROUND' && i.isEquipped);
    const bgVisual = equippedBg?.visualConfig || equippedBg?.visualData || {};

    const equippedBorder = clan.specialInventory?.find(i => i.category === 'BORDER' && i.isEquipped);
    const borderVisual = equippedBorder?.visualConfig || equippedBorder?.visualData || {};

    // --- UPDATED WATERMARK LOGIC WITH SVG RENDER ---
    const equippedWatermark = clan.specialInventory?.find(i => i.category === 'WATERMARK' && i.isEquipped);
    const watermarkVisual = equippedWatermark?.visualConfig || equippedWatermark?.visualData || {};
    
    const SpecialWatermark = () => {
      if (!equippedWatermark) return null;
      
      const iconSize = watermarkVisual.size || 220;
      const iconColor = watermarkVisual.color || (isDark ? 'white' : 'black');
      
      return (
        <View 
          className="absolute" 
          style={{ 
            bottom: -40, 
            right: -40, 
            opacity: watermarkVisual.opacity || 0.08, 
            transform: [{ rotate: watermarkVisual.rotation || '-15deg' }] 
          }}
          pointerEvents="none"
        >
          {watermarkVisual.svgCode ? (
            <SvgXml 
              xml={watermarkVisual.svgCode.replace(/currentColor/g, iconColor)} 
              width={iconSize} 
              height={iconSize} 
            />
          ) : (
            <MaterialCommunityIcons 
              name={watermarkVisual.icon || 'fountain-pen-tip'} 
              size={iconSize} 
              color={iconColor} 
            />
          )}
        </View>
      );
    };

    return (
      <View className="px-4 pt-16 pb-4">
        {equippedBorder ? (
          <>
            <ClanBorder
              color={borderVisual.primaryColor || borderVisual.color || "#ff0000"}
              secondaryColor={borderVisual.secondaryColor || null}
              animationType={borderVisual.animationType || "singleSnake"}
              snakeLength={borderVisual.snakeLength || 120}
              duration={borderVisual.duration || 3000}
            >
              <View className="relative p-5 bg-white dark:bg-[#0a0a0a] shadow-2xl rounded-[35px] overflow-hidden">
                <View className="absolute -top-10 -right-10 w-40 h-40 opacity-10 rounded-full blur-3xl" style={{ backgroundColor: rankInfo.color }} />
                
                {/* Watermark Rendering */}
                <SpecialWatermark />

                {/* --- SVG BACKGROUND GLOW --- */}
                {equippedBg && (
                  <View className="absolute inset-0">
                    <Svg height="100%" width="100%">
                      <Defs>
                        <LinearGradient id="clanCardGrad" x1="0%" y1="0%" x2="100%" >
                          <Stop offset="0%" stopColor={bgVisual.primaryColor || highlightColor} stopOpacity={0.15} />
                          <Stop offset="100%" stopColor={bgVisual.secondaryColor || bgVisual.primaryColor} stopOpacity={0.02} />
                        </LinearGradient>
                      </Defs>
                      <Rect x="0" y="0" width="100%" height="100%" fill="url(#clanCardGrad)" />
                    </Svg>
                  </View>
                )}
                <TouchableOpacity
                  onPress={() => setCardPreviewVisible(true)}
                  className="absolute top-4 right-4 z-10 w-10 h-10 rounded-2xl bg-gray-100/80 dark:bg-gray-800/80 items-center justify-center border border-gray-200 dark:border-gray-700"
                >
                  <Ionicons name="card-outline" size={18} color={isDark ? "white" : "black"} />
                </TouchableOpacity>

                <View className="items-center">
                  <View className="relative items-center justify-center mb-4">
                    <Animated.View style={{ position: 'absolute', width: 120, height: 120, borderRadius: 100, backgroundColor: rankInfo.color, opacity: 0.1, transform: [{ scale: pulseAnim }] }} />
                    <Animated.View style={{ transform: [{ rotate: spin }], borderColor: `${rankInfo.color}40`, width: 140, height: 140 }} className="absolute border border-dashed rounded-full" />
                    <ClanCrest rank={clan.rank || 1} size={110} glowColor={activeGlowColor} />
                  </View>

                  <View className="flex-row items-center gap-1">
                    <Text className="text-2xl font-black italic uppercase tracking-tighter dark:text-white">{clan.name}</Text>
                    {isVerified && (
                      <MaterialCommunityIcons name="check-decagram" size={24} color={highlightColor}  />
                    )}
                    <TouchableOpacity onPress={handleFollow} disabled={loadingFollow} className={`px-2 py-1.5 rounded-full border flex-row items-center gap-2 ${isFollowing ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-transparent' : 'bg-blue-600 border-blue-600'}`}>
                      {loadingFollow ? <ActivityIndicator size="small" color={isFollowing ? "#3b82f6" : "white"} /> :
                        <Text className={`text-[10px] font-black uppercase ${isFollowing ? 'text-gray-500 dark:text-gray-400' : 'text-white'}`}>{isFollowing ? 'Unfollow' : 'Follow'}</Text>}
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity onPress={() => { Clipboard.setString(clan.tag); showAlert("COPIED", "Clan tag copied"); }} style={{ backgroundColor: `${highlightColor}10`, borderColor: `${highlightColor}20` }} className="px-4 py-1.5 flex flex-row items-center gap-1 rounded-full border mb-4">
                    <Text style={{ color: highlightColor }} className="text-xs font-bold tracking-widest uppercase">#{clan.tag}</Text>
                    <Feather name="copy" size={10} style={{ marginLeft: 5, opacity: 0.7, color: highlightColor }} />
                  </TouchableOpacity>

                  <Text className="text-sm text-gray-500 dark:text-gray-400 text-center italic px-4 mb-6">
                    "{clan.description || "A gathering of warriors with no code..."}"
                  </Text>

                  <View className="flex-row gap-6 mt-4 w-full justify-center border-y border-gray-50 dark:border-gray-900/50 py-3">
                    <View className="items-center"><Text className="text-[9px] font-black text-gray-400 uppercase">Followers</Text><Text className="text-sm font-black dark:text-white">{clan.followerCount || 0}</Text></View>
                    <View className="items-center"><Text className="text-[9px] font-black text-gray-400 uppercase">Points</Text><Text className="text-sm font-black" style={{ color: highlightColor ? highlightColor : rankInfo.color }}>{currentPoints}</Text></View>
                    <View className="items-center"><Text className="text-[9px] font-black text-gray-400 uppercase">Members</Text><Text className="text-sm font-black dark:text-white">{clan.members?.length || 0}</Text></View>
                  </View>

                  {clan.badges?.length > 0 && (
                    <View className="flex-row gap-2 mt-3">
                      {clan.badges.map((badgeName, idx) => (
                        <ClanBadge key={`${badgeName}-${idx}`} isClanPage={true} badgeName={badgeName} size="sm" />
                      ))}
                    </View>
                  )}

                  <View className="flex-row items-center justify-between w-full mt-4 px-2">
                    {clan.leader && (
                      <TouchableOpacity onPress={() => router.push(`/author/${clan.leader._id}`)} className="flex-row items-center gap-1.5 bg-gray-50 dark:bg-gray-900 p-1 pr-2 rounded-full border border-gray-100 dark:border-gray-800">
                        <Image source={{ uri: clan.leader.profilePic?.url || "https://via.placeholder.com/150" }} className="w-6 h-6 rounded-full" />
                        <Text className="text-[9px] font-bold dark:text-white">{clan.leader.username}</Text>
                      </TouchableOpacity>
                    )}
                    {clan.isRecruiting && (
                      <TouchableOpacity onPress={handleAuthorRequest} disabled={actionLoading} className="bg-green-500/10 border border-green-500/20 px-4 py-1.5 rounded-full">
                        {actionLoading ? <ActivityIndicator size="small" color="#22c55e" /> : <Text className="text-green-500 text-[10px] font-black uppercase">Apply</Text>}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            </ClanBorder>
            <View className="flex-row items-center gap-4 mt-8 mb-2 px-2">
              <Text className="text-lg font-black italic uppercase tracking-tighter text-gray-900 dark:text-white">Clan Transmissions</Text>
              <View className="h-[1px] flex-1 bg-gray-100 dark:border-gray-800" />
            </View>
          </>
        ) : (
          <>
            <View className="relative p-5 bg-white dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-800 shadow-2xl rounded-[35px] overflow-hidden">
              <View className="absolute -top-10 -right-10 w-40 h-40 opacity-10 rounded-full blur-3xl" style={{ backgroundColor: rankInfo.color }} />
              
              {/* Watermark Rendering for standard card */}
              <SpecialWatermark />

              <TouchableOpacity
                onPress={() => setCardPreviewVisible(true)}
                className="absolute top-4 right-4 z-10 w-10 h-10 rounded-2xl bg-gray-100/80 dark:bg-gray-800/80 items-center justify-center border border-gray-200 dark:border-gray-700"
              >
                <Ionicons name="card-outline" size={18} color={isDark ? "white" : "black"} />
              </TouchableOpacity>

              <View className="items-center">
                <View className="relative items-center justify-center mb-4">
                  <Animated.View style={{ position: 'absolute', width: 120, height: 120, borderRadius: 100, backgroundColor: rankInfo.color, opacity: 0.1, transform: [{ scale: pulseAnim }] }} />
                  <Animated.View style={{ transform: [{ rotate: spin }], borderColor: `${rankInfo.color}40`, width: 140, height: 140 }} className="absolute border border-dashed rounded-full" />
                  <ClanCrest rank={clan.rank || 1} size={110} glowColor={activeGlowColor} />
                </View>

                <View className="flex-row items-center gap-3">
                  <Text className="text-2xl font-black italic uppercase tracking-tighter dark:text-white">{clan.name}</Text>
                  <TouchableOpacity onPress={handleFollow} disabled={loadingFollow} className={`px-4 py-1.5 rounded-full border flex-row items-center gap-2 ${isFollowing ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-transparent' : 'bg-blue-600 border-blue-600'}`}>
                    {loadingFollow ? <ActivityIndicator size="small" color={isFollowing ? "#3b82f6" : "white"} /> :
                      <Text className={`text-[10px] font-black uppercase ${isFollowing ? 'text-gray-500 dark:text-gray-400' : 'text-white'}`}>{isFollowing ? 'Unfollow' : 'Follow'}</Text>}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={() => { Clipboard.setString(clan.tag); showAlert("COPIED", "Clan tag copied"); }} className="flex-row items-center mt-1 bg-blue-500/5 px-2.5 py-1 rounded-full border border-blue-500/10">
                  <Text className="text-[10px] font-bold text-blue-500 tracking-widest uppercase">#{clan.tag}</Text>
                  <Feather name="copy" size={10} color="#3b82f6" style={{ marginLeft: 5, opacity: 0.7 }} />
                </TouchableOpacity>

                <Text className="text-xs text-gray-500 dark:text-gray-400 text-center italic mt-2 px-6">"{clan.description || "A gathering of warriors..."}"</Text>

                <View className="flex-row gap-6 mt-4 w-full justify-center border-y border-gray-50 dark:border-gray-900/50 py-3">
                  <View className="items-center"><Text className="text-[9px] font-black text-gray-400 uppercase">Followers</Text><Text className="text-sm font-black dark:text-white">{clan.followerCount || 0}</Text></View>
                  <View className="items-center"><Text className="text-[9px] font-black text-gray-400 uppercase">Points</Text><Text className="text-sm font-black" style={{ color: rankInfo.color }}>{currentPoints}</Text></View>
                  <View className="items-center"><Text className="text-[9px] font-black text-gray-400 uppercase">Members</Text><Text className="text-sm font-black dark:text-white">{clan.members?.length || 0}</Text></View>
                </View>

                {clan.badges?.length > 0 && (
                  <View className="flex-row gap-2 mt-3">
                    {clan.badges.map((badgeName, idx) => (
                      <ClanBadge key={`${badgeName}-${idx}`} isClanPage={true} badgeName={badgeName} size="sm" />
                    ))}
                  </View>
                )}

                <View className="flex-row items-center justify-between w-full mt-4 px-2">
                  {clan.leader && (
                    <TouchableOpacity onPress={() => router.push(`/author/${clan.leader._id}`)} className="flex-row items-center gap-1.5 bg-gray-50 dark:bg-gray-900 p-1 pr-2 rounded-full border border-gray-100 dark:border-gray-800">
                      <Image source={{ uri: clan.leader.profilePic?.url || "https://via.placeholder.com/150" }} className="w-6 h-6 rounded-full" />
                      <Text className="text-[9px] font-bold dark:text-white">{clan.leader.username}</Text>
                    </TouchableOpacity>
                  )}
                  {clan.isRecruiting && (
                    <TouchableOpacity onPress={handleAuthorRequest} disabled={actionLoading} className="bg-green-500/10 border border-green-500/20 px-4 py-1.5 rounded-full">
                      {actionLoading ? <ActivityIndicator size="small" color="#22c55e" /> : <Text className="text-green-500 text-[10px] font-black uppercase">Apply</Text>}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>

            <View className="flex-row items-center gap-4 mt-8 mb-2 px-2">
              <Text className="text-lg font-black italic uppercase tracking-tighter text-gray-900 dark:text-white">Clan Transmissions</Text>
              <View className="h-[1px] flex-1 bg-gray-100 dark:border-gray-800" />
            </View>
          </>
        )}
      </View>
    );
  };

  const renderItem = ({ item }) => (
    <View className={'px-3'}><PostCard post={item} isFeed /></View>
  );

  if (isInitialMount) {
    return <View style={{ backgroundColor: isDark ? "#050505" : "#ffffff" }} className="flex-1 items-center justify-center"><SyncLoading message='Decrypting Intel' /></View>
  }

  return (
    <View className="flex-1 bg-white dark:bg-[#0a0a0a]">
      <FlatList
        ref={scrollRef}
        data={posts}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={<View className="py-10">{loading && <SyncLoading />}</View>}
        onEndReached={fetchMorePosts}
        onEndReachedThreshold={0.5}
        onRefresh={() => { setPage(1); fetchInitialData(); }}
        refreshing={refreshing}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      />

      {/* Hidden Capture Layer */}
      <View style={{ position: 'absolute', left: -10000, opacity: 0 }} pointerEvents="none">
        <ViewShot ref={clanCardRef} options={{ format: "png", quality: 1 }}>
          <ClanCard clan={clan} isDark={isDark} forSnapshot={true} />
        </ViewShot>
      </View>

      {/* 🔹 Clan Card Preview Modal */}
      <Modal visible={cardPreviewVisible} transparent animationType="slide">
        <View className="flex-1 bg-black/95">
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View className="w-full items-center">
              <View className="w-full flex-row justify-between items-center pt-10">
                <View>
                  <Text className="text-white font-black text-xl italic uppercase tracking-widest">Clan Scroll</Text>
                  <Text className="text-gray-500 font-bold text-[9px] uppercase tracking-[0.4em] mt-1">Official Manifest</Text>
                </View>
                <Pressable onPress={() => setCardPreviewVisible(false)} className="w-12 h-12 bg-white/10 rounded-full items-center justify-center">
                  <Ionicons name="close" size={28} color="white" />
                </Pressable>
              </View>

              <View style={{ transform: [{ scale: Math.min(1, (width - 40) / 380) }], width: 380, alignItems: 'center' }}>
                <ClanCard clan={clan} isDark={isDark} forSnapshot={true} />
              </View>

              <View className="w-full">
                <TouchableOpacity
                  onPress={captureAndShare}
                  style={{ backgroundColor: getClanTierDetails(clan?.rankTitle).color }}
                  className="flex-row items-center justify-center gap-3 w-full h-16 rounded-[30px] shadow-lg"
                >
                  <MaterialCommunityIcons name="share-variant" size={24} color="white" />
                  <Text className="text-white font-black uppercase tracking-[0.2em] text-sm italic">Dispatch Scroll</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}