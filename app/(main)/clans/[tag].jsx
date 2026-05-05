import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LegendList } from "@legendapp/list";
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router"; // ⚡️ ADDED: useFocusEffect
import * as Sharing from "expo-sharing";
import { useColorScheme } from "nativewind";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Clipboard,
  DeviceEventEmitter,
  Dimensions,
  Image,
  InteractionManager,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from "react-native";
import { useMMKV } from 'react-native-mmkv';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ViewShot from "react-native-view-shot";
import { mutate as globalMutate } from "swr"; // ⚡️ ADDED: globalMutate for instant hydration

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

import PlayerBackground from "../../../components/PlayerBackground";
import PlayerNameplate from "../../../components/PlayerNameplate";
import PlayerWatermark from "../../../components/PlayerWatermark";

import AnimatedReanimated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";
import { SvgXml } from "react-native-svg";

const API_BASE = "https://oreblogda.com/api";
const { width } = Dimensions.get('window');

const PostSkeleton = memo(() => {
  const isDark = useColorScheme() === "dark";
  return (
    <View className={`mb-8 p-4 rounded-[32px] border ${isDark ? "bg-[#0d1117] border-gray-800" : "bg-white border-gray-100"} opacity-40`}>
      <View className="flex-row items-center gap-4 mb-6">
        <View className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-800" />
        <View className="flex-1 gap-2">
          <View className="w-32 h-3 bg-gray-200 dark:bg-gray-800 rounded-md" />
          <View className="w-20 h-2 bg-gray-100 dark:bg-gray-900 rounded-md" />
        </View>
      </View>
      <View className="w-full h-6 bg-gray-200 dark:bg-gray-800 rounded-md mb-3" />
      <View className="w-3/4 h-6 bg-gray-200 dark:bg-gray-800 rounded-md mb-6" />
      <View className="w-full h-64 bg-gray-100 dark:bg-gray-900 rounded-2xl mb-6" />
      <View className="flex-row justify-between items-center border-t border-gray-100 dark:border-gray-800 pt-4">
        <View className="flex-row gap-6">
          <View className="w-12 h-4 bg-gray-100 dark:bg-gray-800 rounded-full" />
          <View className="w-12 h-4 bg-gray-100 dark:bg-gray-800 rounded-full" />
        </View>
        <View className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full" />
      </View>
    </View>
  );
});

const CLAN_MEMORY_CACHE = {};
const CLAN_POSTS_MEMORY_CACHE = {};

const THEME = { accent: "#3b82f6" };

const getClanTierDetails = (rankNumber) => {
  switch (rankNumber) {
    case 6: return { title: "The Akatsuki", color: '#ef4444' };
    case 5: return { title: "The Espada", color: '#e0f2fe' };
    case 4: return { title: "Phantom Troupe", color: '#a855f7' };
    case 3: return { title: "Upper Moon", color: '#60a5fa' };
    case 2: return { title: "Squad 13", color: '#10b981' };
    default: return { title: "Wandering Ronin", color: '#94a3b8' };
  }
};

const AnimatedProgressBar = memo(({ scoreA, scoreB }) => {
  const total = scoreA + scoreB || 1;
  const pctA = (scoreA / total) * 100;
  const glowValue = useSharedValue(0);

  useEffect(() => {
    glowValue.value = withRepeat(withTiming(1, { duration: 1500 }), -1, true);
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowValue.value, [0, 1], [0.6, 1]),
  }));

  return (
    <View className="mt-2 w-full px-3 pb-4">
      <Text className="text-[9px] font-black uppercase text-gray-500 text-center tracking-widest mb-2">War Dominance</Text>
      <View className="h-4 flex-row rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
        <AnimatedReanimated.View className="h-full bg-blue-500" style={[{ width: `${pctA}%` }, pctA > 50 ? glowStyle : null]} />
        <AnimatedReanimated.View className="h-full bg-red-600" style={[{ width: `${100 - pctA}%` }]} />
      </View>
      <View className="flex-row justify-between mt-2 px-1">
        <Text className="text-blue-500 dark:text-blue-400 font-black italic text-lg">{Math.round(pctA)}%</Text>
        <Text className="text-red-600 dark:text-red-500 font-black italic text-lg">{Math.round(100 - pctA)}%</Text>
      </View>
    </View>
  );
});

// ⚡️ PERFORMANCE FIX 1: Memoized Post Item
const MemoizedPostItem = memo(({ item, isVisible }) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(false);
    const task = InteractionManager.runAfterInteractions(() => {
      setIsReady(true);
    });
    return () => task.cancel();
  }, [item._id]);

  if (!isReady) return <PostSkeleton />;

  return (
    <View className="px-3">
      <PostCard
        post={item}
        authorData={item.authorData}
        clanData={item.clanData}
        isFeed
        isVisible={isVisible}
      />
    </View>
  );
}, (prevProps, nextProps) => {
  return prevProps.isVisible === nextProps.isVisible && prevProps.item === nextProps.item;
});

export default function ClanPage() {
  const { tag } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useUser();
  const showAlert = useAlert();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const storage = useMMKV();

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
  const [isSaving, setIsSaving] = useState(false);

  const [isFollowing, setIsFollowing] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [visibleIds, setVisibleIds] = useState(new Set());

  const scrollRef = useRef(null);
  const clanCardRef = useRef(null);

  const pulseAnim = useSharedValue(1);
  const rotationAnim = useSharedValue(0);
  const skeletonFade = useSharedValue(0.3);

  useEffect(() => {
    pulseAnim.value = withRepeat(withSequence(withTiming(1.1, { duration: 2000 }), withTiming(1, { duration: 2000 })), -1, true);
    rotationAnim.value = withRepeat(withTiming(1, { duration: 20000, easing: Easing.linear }), -1, false);
    skeletonFade.value = withRepeat(withSequence(withTiming(0.7, { duration: 800 }), withTiming(0.3, { duration: 800 })), -1, true);
  }, []);

  const spinAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${interpolate(rotationAnim.value, [0, 1], [0, 360])}deg` }] }));
  const pulseAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseAnim.value }] }));
  const skeletonAnimatedStyle = useAnimatedStyle(() => ({ opacity: skeletonFade.value }));

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("doScrollToTop", () => {
      scrollRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
    return () => sub.remove();
  }, []);

  const saveHeavyCache = useCallback((key, data) => {
    try { storage.set(key, JSON.stringify(data)); } catch (e) { console.error("Cache Save Error", e); }
  }, [storage]);

  useEffect(() => {
    const checkFollowStatus = () => {
      if (!user) return;
      try {
        const followedClansStr = storage.getString('followed_clans');
        if (__DEV__) (followedClansStr);

        const checkedClansStr = storage.getString('checked_clans');
        let followedClans = followedClansStr ? JSON.parse(followedClansStr) : [];
        let checkedClans = checkedClansStr ? JSON.parse(checkedClansStr) : [];

        if (followedClans.includes(tag)) { setIsFollowing(true); return; }
        if (checkedClans.includes(tag)) { setIsFollowing(false); return; }

        apiFetch(`/clans/follow?clanTag=${tag}&deviceId=${user.deviceId}`)
          .then(res => res.json())
          .then(data => {
            if (data.isFollowing) {
              setIsFollowing(true);
              followedClans.push(tag);
              storage.set('followed_clans', JSON.stringify(followedClans));
            } else {
              setIsFollowing(false);
              checkedClans.push(tag);
              storage.set('checked_clans', JSON.stringify(checkedClans));
            }
          })
          .catch(e => { console.error("Follow status sync error", e) });

      } catch (e) { console.error("Follow status sync error", e); }
    };
    checkFollowStatus();
  }, [tag, user, storage]);

  const fetchInitialData = useCallback(async () => {
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
      InteractionManager.runAfterInteractions(() => {
        setTimeout(() => setIsInitialMount(false), 500);
      });
    }
  }, [tag, user?.deviceId, CACHE_KEY_CLAN, CACHE_KEY_POSTS, saveHeavyCache]);

  const fetchMorePosts = useCallback(async () => {
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
  }, [hasMore, loading, posts.length, isOffline, page, tag, CACHE_KEY_POSTS]);

  useEffect(() => {
    const init = () => {
      if (CLAN_MEMORY_CACHE[CACHE_KEY_CLAN]) {
        setIsInitialMount(false);
        fetchInitialData()
        return;
      }
      try {
        const cClan = storage.getString(CACHE_KEY_CLAN);
        const cPosts = storage.getString(CACHE_KEY_POSTS);

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
      } catch (e) { console.error("MMKV Init Error", e); }

      fetchInitialData();
    };
    init();
  }, [tag, user?.deviceId, fetchInitialData, storage, CACHE_KEY_CLAN, CACHE_KEY_POSTS]);

  // ⚡️ INSTANT FOCUS SYNC: Solves the "likes not updating" bug when returning from post view
  useFocusEffect(
    useCallback(() => {
      globalMutate(
        key => typeof key === 'string' && key.startsWith('/posts/'),
        undefined,
        { revalidate: true }
      );
    }, [])
  );

  const performFollowAction = async (action) => {
    setLoadingFollow(true);
    try {
      const res = await apiFetch(`/clans/follow`, {
        method: "POST",
        body: JSON.stringify({ clanTag: tag, deviceId: user.deviceId, action: action })
      });

      if (res.ok) {
        const followedClansStr = storage.getString('followed_clans');
        const checkedClansStr = storage.getString('checked_clans');
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
        storage.set('followed_clans', JSON.stringify(clanList));
        storage.set('checked_clans', JSON.stringify(checkedList));
      }
      if (res.status == 419) {
        const followedClansStr = storage.getString('followed_clans');
        const checkedClansStr = storage.getString('checked_clans');
        let clanList = followedClansStr ? JSON.parse(followedClansStr) : [];
        let checkedList = checkedClansStr ? JSON.parse(checkedClansStr) : [];
        showAlert("CLAN JOINED", `You are already following ${clan?.name}.`);
        setIsFollowing(true);
        if (!clanList.includes(tag)) clanList.push(tag);
        checkedList = checkedList.filter(t => t !== tag);

        storage.set('followed_clans', JSON.stringify(clanList));
        storage.set('checked_clans', JSON.stringify(checkedList));
      }
    } catch (err) { showAlert("CONNECTION ERROR", "Check your internet connection."); } finally { setLoadingFollow(false); }
  };

  const handleFollow = () => {
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
      else if (res.status === 403) { showAlert("ALREADY IN A CLAN", "You are already in a CLAN. One cannot serve two masters."); }
      else if (res.status === 400) { showAlert("ALREADY REQUESTED", "Request already pending."); }
      else if (res.status === 401) { showAlert("REQUEST DISMISSED", "Recruitment is closed or clan is full."); }
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

  const captureAndSave = async () => {
    try {
      if (clanCardRef.current) {
        setIsSaving(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const uri = await clanCardRef.current.capture();
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted') {
          await MediaLibrary.saveToLibraryAsync(uri);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showAlert("Archived", "Clan Scroll saved to device.");
        } else {
          showAlert("Permission Denied", "Gallery access required.");
        }
      }
    } catch (error) {
      console.error("Save Error:", error);
      showAlert("Error", "Failed to save.");
    } finally {
      setIsSaving(false);
    }
  };


  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    const newVisible = new Set(viewableItems.map(v => v.item._id));
    setVisibleIds(newVisible);
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const lastScrollY = useRef(0);
  const handleScroll = useCallback((e) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    if (Math.abs(offsetY - lastScrollY.current) > 20) {
      DeviceEventEmitter.emit("onScroll", offsetY);
      lastScrollY.current = offsetY;
    }
  }, []);

  const listData = useMemo(() => {
    if (loading && page === 1) {
      return Array.from({ length: 5 }).map((_, i) => ({ _id: `skeleton-${i}`, isGhost: true }));
    }
    const list = [...posts];
    if (loading && posts.length > 0) {
      list.push({ _id: 'skeleton-more-1', isGhost: true }, { _id: 'skeleton-more-2', isGhost: true });
    }
    return list;
  }, [posts, loading, page]);

  const renderItem = useCallback(({ item }) => (
    item.isGhost ? <PostSkeleton /> : (
      <MemoizedPostItem item={item} isVisible={true} />
    )
  ), []);

  const ClanSkeleton = useCallback(() => (
    <View className="px-4 pt-20 pb-6 opacity-40">
      <View className="p-6 bg-gray-100 dark:bg-[#111] border border-gray-200 dark:border-gray-800 rounded-[40px] items-center">
        <AnimatedReanimated.View style={skeletonAnimatedStyle} className="w-32 h-32 bg-gray-300 dark:bg-gray-800 rounded-full mb-6" />
        <AnimatedReanimated.View style={skeletonAnimatedStyle} className="w-48 h-8 bg-gray-300 dark:bg-gray-800 rounded-lg mb-4" />
      </View>
    </View>
  ), [skeletonAnimatedStyle]);

  const ListHeader = useCallback(() => {
    if (!clan && isOffline) return <ClanSkeleton />;
    if (!clan) return null;

    const nextMilestone = clan.nextThreshold || 5000;
    const currentPoints = clan.totalPoints || 0;
    const isVerified = clan.verifiedUntil && new Date(clan.verifiedUntil) > new Date();
    const verifiedTier = clan.activeCustomizations?.verifiedTier;
    const verifiedColor = verifiedTier === "premium" ? "#facc15" : verifiedTier === "standard" ? "#ef4444" : verifiedTier === "basic" ? "#3b82f6" : "";

    const rankInfo = getClanTierDetails(clan.rank || 1);
    const highlightColor = isVerified ? verifiedColor : (rankInfo.color || THEME.accent);

    const equippedGlow = clan.specialInventory?.find(i => i.category === 'GLOW' && i.isEquipped);
    const activeGlowColor = equippedGlow?.visualConfig?.primaryColor || equippedGlow?.visualData?.glowColor || null;

    const equippedBg = clan.specialInventory?.find(i => i.category === 'BACKGROUND' && i.isEquipped);
    const equippedBorder = clan.specialInventory?.find(i => i.category === 'BORDER' && i.isEquipped);
    const borderVisual = equippedBorder?.visualConfig || equippedBorder?.visualData || {};
    const equippedWatermark = clan.specialInventory?.find(i => i.category === 'WATERMARK' && i.isEquipped);

    const equippedBadges = clan.specialInventory?.filter(i => i.category === 'BADGE' && i.isEquipped).slice(0, 10) || [];

    const HeaderCard = (
      <View className="relative p-5 bg-white dark:bg-[#0a0a0a] shadow-2xl rounded-[35px] overflow-hidden">
        <View className="absolute -top-10 -right-10 w-40 h-40 opacity-10 rounded-full blur-3xl" style={{ backgroundColor: rankInfo.color }} />

        <PlayerBackground equippedBg={equippedBg} themeColor={rankInfo.color} borderRadius={35} />
        <PlayerWatermark equippedWatermark={equippedWatermark} isDark={isDark} />

        <TouchableOpacity
          onPress={() => setCardPreviewVisible(true)}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-2xl bg-gray-100/80 dark:bg-gray-800/80 items-center justify-center border border-gray-200 dark:border-gray-700"
        >
          <Ionicons name="card-outline" size={18} color={isDark ? "white" : "black"} />
        </TouchableOpacity>

        <View className="items-center">
          <View className="relative items-center justify-center mb-4">
            <AnimatedReanimated.View style={[{ position: 'absolute', width: 120, height: 120, borderRadius: 100, backgroundColor: rankInfo.color, opacity: 0.1 }, pulseAnimatedStyle]} />
            <AnimatedReanimated.View style={[{ borderColor: `${rankInfo.color}40`, width: 140, height: 140 }, spinAnimatedStyle]} className="absolute border border-dashed rounded-full" />
            <ClanCrest rank={clan.rank || 1} size={110} glowColor={activeGlowColor} />
          </View>

          <View className="flex-row items-center gap-1 justify-center mb-2">
            <PlayerNameplate
              author={{ username: clan.name }}
              themeColor={rankInfo.color}
              equippedGlow={equippedGlow}
              auraRank={999}
              fontSize={24}
              isDark={isDark}
              showPeakBadge={false}
              showFlame={false}
            />
            {isVerified && (
              <View className="ml-1"><SvgXml xml={clan.activeCustomizations?.verifiedBadgeXml} width={24} height={24} /></View>
            )}
            <TouchableOpacity onPress={handleFollow} disabled={loadingFollow} className={`px-2 py-1.5 rounded-full border flex-row items-center gap-2 ml-2 ${isFollowing ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-transparent' : 'bg-blue-600 border-blue-600'}`}>
              {loadingFollow ? <ActivityIndicator size="small" color={isFollowing ? "#3b82f6" : "white"} /> :
                <Text className={`text-[10px] font-black uppercase ${isFollowing ? 'text-gray-500 dark:text-gray-400' : 'text-white'}`}>{isFollowing ? 'Unfollow' : 'Follow'}</Text>}
            </TouchableOpacity>
          </View>

          {/* {equippedBadges.length > 0 && (
            <View className="flex-row flex-wrap justify-center gap-2 mb-4 mt-1">
              {equippedBadges.map((badge, idx) => (
                <BadgeIcon key={idx} badge={badge} size={20} isDark={isDark} />
              ))}
            </View>
          )} */}

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

          {clan.badges?.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 3, marginVertical: 5, }}>
              {clan.badges.map((badgeName, idx) => (
                <ClanBadge key={`${badgeName}-${idx}`} isClanPage={true} badgeName={badgeName} size={40} />
              ))}
            </ScrollView>
          ) : (
            <View className="items-center h-fit py-2">
              <Text className="text-[10px] font-bold uppercase text-gray-400">No Medal Earned</Text>
            </View>
          )}

          <View className="flex-row items-center justify-between w-full mt-4 px-3">
            {clan.leader && (
              <TouchableOpacity onPress={() => router.push(`/author/${clan.leader._id}`)} className="flex-row items-center gap-1.5 bg-gray-50 dark:bg-gray-900 p-1 pr-2 rounded-full border border-gray-100 dark:border-gray-800">
                <Image
                  source={{ uri: clan.leader.profilePic?.url || "https://oreblogda.com/default-avatar.png" }}
                  style={{ width: 30, height: 30, borderRadius: 16 }}
                />
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
    );

    return (
      <View className="px-4 pt-16 pb-4">
        {equippedBorder ? (
          <ClanBorder
            color={borderVisual.primaryColor || borderVisual.color || "#ff0000"}
            secondaryColor={borderVisual.secondaryColor || null}
            animationType={borderVisual.animationType || "singleSnake"}
            snakeLength={borderVisual.snakeLength || 120}
            duration={borderVisual.duration || 3000}
          >
            {HeaderCard}
          </ClanBorder>
        ) : HeaderCard}

        <View className="flex-row items-center gap-4 mt-8 mb-2 px-2">
          <Text className="text-lg font-black italic uppercase tracking-tighter text-gray-900 dark:text-white">Clan Transmissions</Text>
          <View className="h-[1px] flex-1 bg-gray-100 dark:border-gray-800" />
        </View>
      </View>
    );
  }, [clan, isOffline, isDark, pulseAnimatedStyle, spinAnimatedStyle, skeletonAnimatedStyle, isFollowing, loadingFollow, actionLoading, showAlert, handleFollow, handleAuthorRequest, router]);

  if (isInitialMount) {
    return <View style={{ backgroundColor: isDark ? "#050505" : "#ffffff" }} className="flex-1 items-center justify-center"><SyncLoading message='Decrypting Intel' /></View>
  }

  return (
    <View className="flex-1 bg-white dark:bg-[#0a0a0a]">
      {/* ⚡️ PERFORMANCE FIX 5: Full LegendList Config */}
      <LegendList
        key={`clan-list-${tag}`} // ⚡️ FIXED: Isolates scroll memory per clan
        ref={scrollRef}
        data={posts}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        removeClippedSubviews={true}

        estimatedItemSize={630}
        recycleItems={true}
        drawDistance={1000}
        // ⚡️ FIXED: Removed recycleItems=true to stop weird SWR caching bugs and scroll jumping

        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScroll={handleScroll}
        scrollEventThrottle={16}

        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}

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
      />
      {cardPreviewVisible && (
        <View style={{ position: 'absolute', left: -10000, opacity: 0 }} pointerEvents="none">
          <ViewShot ref={clanCardRef} options={{ format: "png", quality: 1 }}>
            <View style={{ transform: [{ scale: Math.min(1, (width - 40) / 380) }], width: 380, alignItems: 'center' }}>
              <ClanCard clan={clan} isDark={isDark} forSnapshot={true} />
            </View>
          </ViewShot>
        </View>
      )}

      <Modal visible={cardPreviewVisible} transparent animationType="slide">
        <View className="flex-1 bg-black/95">
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCardPreviewVisible(false)} />
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

              {cardPreviewVisible && (
                <View style={{ transform: [{ scale: Math.min(1, (width - 40) / 380) }], width: 380, alignItems: 'center', marginTop: 30 }}>
                  <ClanCard clan={clan} isDark={isDark} forSnapshot={true} />
                </View>
              )}

              <View className="w-full mt-10">
                <View className="flex-row gap-3 w-full">
                  <TouchableOpacity
                    onPress={captureAndSave}
                    disabled={isSaving}
                    className="flex-1 h-16 bg-gray-800 rounded-[30px] items-center justify-center border border-gray-700 active:scale-95"
                  >
                    {isSaving ? <ActivityIndicator size="small" color="white" /> : (
                      <View className="flex-row items-center gap-2">
                        <Feather name="download" size={20} color="white" />
                        <Text className="text-white font-black uppercase text-[10px] tracking-widest italic">Save</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={captureAndShare}
                    style={{ backgroundColor: clan ? getClanTierDetails(clan.rank || 1).color : '#3b82f6' }}
                    className="flex-[2] h-16 rounded-[30px] flex-row items-center justify-center gap-3 shadow-lg active:scale-95"
                  >
                    <MaterialCommunityIcons name="share-variant" size={24} color="white" />
                    <Text className="text-white font-black uppercase tracking-[0.2em] text-sm italic">Dispatch Scroll</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}