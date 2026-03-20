import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useRef, useState, memo } from "react";
import {
  ActivityIndicator,
  Image,
  Clipboard,
  DeviceEventEmitter,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View
} from "react-native";
import { useMMKV } from 'react-native-mmkv';
import { LegendList } from "@legendapp/list";
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

import AnimatedReanimated, { 
    useSharedValue, 
    withRepeat, 
    withTiming, 
    withSequence,
    useAnimatedStyle, 
    interpolate,
    Easing
} from "react-native-reanimated";

const API_BASE = "https://oreblogda.com/api";
const { width } = Dimensions.get('window');

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
    <View className="mt-6">
      <View className="h-5 flex-row rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
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

  const [isFollowing, setIsFollowing] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const scrollRef = useRef(null);
  const clanCardRef = useRef(null);

  const pulseAnim = useSharedValue(1);
  const rotationAnim = useSharedValue(0);
  const skeletonFade = useSharedValue(0.3);

  useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 2000 }),
        withTiming(1, { duration: 2000 })
      ),
      -1,
      true
    );

    rotationAnim.value = withRepeat(
      withTiming(1, { duration: 20000, easing: Easing.linear }),
      -1,
      false
    );

    skeletonFade.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800 }),
        withTiming(0.3, { duration: 800 })
      ),
      -1,
      true
    );
  }, []);

  const spinAnimatedStyle = useAnimatedStyle(() => {
      const rotate = interpolate(rotationAnim.value, [0, 1], [0, 360]);
      return {
          transform: [{ rotate: `${rotate}deg` }]
      };
  });

  const pulseAnimatedStyle = useAnimatedStyle(() => {
      return {
          transform: [{ scale: pulseAnim.value }]
      };
  });

  const skeletonAnimatedStyle = useAnimatedStyle(() => {
      return {
          opacity: skeletonFade.value
      };
  });

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("doScrollToTop", () => {
      scrollRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
    return () => sub.remove();
  }, []);

  const saveHeavyCache = useCallback((key, data) => {
    try {
      storage.set(key, JSON.stringify(data));
    } catch (e) { console.error("Cache Save Error", e); }
  }, [storage]);

  useEffect(() => {
    const checkFollowStatus = () => {
      if (!user) return;
      try {
        const followedClansStr = storage.getString('followed_clans');
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
          .catch(e => console.error("Follow status sync error", e));

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
      setTimeout(() => setIsInitialMount(false), 800);
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

  const ClanSkeleton = useCallback(() => (
    <View className="px-4 pt-20 pb-6 opacity-40">
      <View className="p-6 bg-gray-100 dark:bg-[#111] border border-gray-200 dark:border-gray-800 rounded-[40px] items-center">
        <AnimatedReanimated.View style={skeletonAnimatedStyle} className="w-32 h-32 bg-gray-300 dark:bg-gray-800 rounded-full mb-6" />
        <AnimatedReanimated.View style={skeletonAnimatedStyle} className="w-48 h-8 bg-gray-300 dark:bg-gray-800 rounded-lg mb-4" />
      </View>
    </View>
  ), [skeletonAnimatedStyle]);

  const RemoteSvgIcon = useCallback(({ xml, size = 50, color }) => {
    if (!xml) return <MaterialCommunityIcons name="help-circle-outline" size={size} color="gray" />;
    return <SvgXml xml={xml} width={size} height={size} />;
  }, []);

  const ListHeader = useCallback(() => {
    if (!clan && isOffline) return <ClanSkeleton />;
    if (!clan) return null;

    const nextMilestone = clan.nextThreshold || 5000;
    const currentPoints = clan.totalPoints || 0;
    const progress = Math.min((currentPoints / nextMilestone) * 100, 100);
    const isVerified = clan.verifiedUntil && new Date(clan.verifiedUntil) > new Date();
    const verifiedTier = clan.activeCustomizations?.verifiedTier;
    const verifiedColor = verifiedTier === "premium" ? "#facc15" : verifiedTier === "standard" ? "#ef4444" : verifiedTier === "basic" ? "#3b82f6" : "";
    
    const rankInfo = getClanTierDetails(clan.rank || 1);
    const highlightColor = isVerified ? verifiedColor : (rankInfo.color || THEME.accent);

    const equippedGlow = clan.specialInventory?.find(i => i.category === 'GLOW' && i.isEquipped);
    const activeGlowColor = equippedGlow?.visualConfig?.primaryColor || equippedGlow?.visualData?.glowColor || null;

    const equippedBg = clan.specialInventory?.find(i => i.category === 'BACKGROUND' && i.isEquipped);
    const bgVisual = equippedBg?.visualConfig || equippedBg?.visualData || {};

    const equippedBorder = clan.specialInventory?.find(i => i.category === 'BORDER' && i.isEquipped);
    const borderVisual = equippedBorder?.visualConfig || equippedBorder?.visualData || {};

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
            bottom: -20,
            right: -20,
            opacity: 0.7,
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

                <SpecialWatermark />

                {equippedBg && (
                  <View className="absolute inset-0">
                    <Svg height="100%" width="100%">
                      <Defs>
                        <LinearGradient id="clanCardGrad" x1="0%" y1="0%" x2="100%" >
                          <Stop offset="0%" stopColor={bgVisual.primaryColor} stopOpacity={0.15} />
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
                    <AnimatedReanimated.View style={[{ position: 'absolute', width: 120, height: 120, borderRadius: 100, backgroundColor: rankInfo.color, opacity: 0.1 }, pulseAnimatedStyle]} />
                    <AnimatedReanimated.View style={[{ borderColor: `${rankInfo.color}40`, width: 140, height: 140 }, spinAnimatedStyle]} className="absolute border border-dashed rounded-full" />
                    <ClanCrest rank={clan.rank || 1} size={110} glowColor={activeGlowColor || verifiedColor} />
                  </View>

                  <View className="flex-row items-center gap-1">
                    <Text className="text-2xl font-black italic uppercase tracking-tighter dark:text-white">{clan.name}</Text>
                    {isVerified && (
                      <RemoteSvgIcon size={24} xml={clan.activeCustomizations?.verifiedBadgeXml} />
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
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 3 }}>
                      {clan.badges.map((badgeName, idx) => (
                        <ClanBadge key={`${badgeName}-${idx}`} isClanPage={true} badgeName={badgeName} size="sm" />
                      ))}
                    </ScrollView>
                  )}

                  <View className="flex-row items-center justify-between w-full mt-4 p-3">
                    {clan.leader && (
                      <TouchableOpacity onPress={() => router.push(`/author/${clan.leader._id}`)} className="flex-row items-center gap-1.5 bg-gray-50 dark:bg-gray-900 p-1 pr-2 rounded-full border border-gray-100 dark:border-gray-800">
                        <Image
                          source={{ uri: clan.leader.profilePic?.url || "https://oreblogda.com/default-avatar.png" }}
                          contentFit="cover"
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
            </ClanBorder>
            <View className="flex-row items-center gap-4 mt-8 mb-2 px-2">
              <Text className="text-lg font-black italic uppercase tracking-tighter text-gray-900 dark:text-white">Clan Transmissions</Text>
              <View className="h-[1px] flex-1 bg-gray-100 dark:border-gray-800" />
            </View>
          </>
        ) : (
          <>
            <View className="relative p-5 bg-white dark:bg-[#0a0a0a] shadow-2xl rounded-[35px] overflow-hidden">
              <View className="absolute -top-10 -right-10 w-40 h-40 opacity-10 rounded-full blur-3xl" style={{ backgroundColor: rankInfo.color }} />

              <SpecialWatermark />

              {equippedBg && (
                <View className="absolute inset-0">
                  <Svg height="100%" width="100%">
                    <Defs>
                      <LinearGradient id="clanCardGrad" x1="0%" y1="0%" x2="100%" >
                        <Stop offset="0%" stopColor={bgVisual.primaryColor} stopOpacity={0.25} />
                        <Stop offset="100%" stopColor={bgVisual.secondaryColor || bgVisual.primaryColor} stopOpacity={0.12} />
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
                  <AnimatedReanimated.View style={[{ position: 'absolute', width: 120, height: 120, borderRadius: 100, backgroundColor: rankInfo.color, opacity: 0.1 }, pulseAnimatedStyle]} />
                  <AnimatedReanimated.View style={[{ borderColor: `${rankInfo.color}40`, width: 140, height: 140 }, spinAnimatedStyle]} className="absolute border border-dashed rounded-full" />
                  <ClanCrest rank={clan.rank || 1} size={110} glowColor={activeGlowColor || verifiedColor} />
                </View>

                <View className="flex-row items-center gap-1">
                  <Text className="text-2xl font-black italic uppercase tracking-tighter dark:text-white">{clan.name}</Text>
                  {isVerified && (
                    <RemoteSvgIcon size={24} xml={clan.activeCustomizations?.verifiedBadgeXml} />
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
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 3 }}>
                    {clan.badges.map((badgeName, idx) => (
                      <ClanBadge key={`${badgeName}-${idx}`} isClanPage={true} badgeName={badgeName} size="sm" />
                    ))}
                  </ScrollView>
                )}

                <View className="flex-row items-center justify-between w-full mt-4 p-3">
                  {clan.leader && (
                    <TouchableOpacity onPress={() => router.push(`/author/${clan.leader._id}`)} className="flex-row items-center gap-1.5 bg-gray-50 dark:bg-gray-900 p-1 pr-2 rounded-full border border-gray-100 dark:border-gray-800">
                      <Image
                        source={{ uri: clan.leader.profilePic?.url || "https://oreblogda.com/default-avatar.png" }}
                        contentFit="cover"
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

            <View className="flex-row items-center gap-4 mt-8 mb-2 px-2">
              <Text className="text-lg font-black italic uppercase tracking-tighter text-gray-900 dark:text-white">Clan Transmissions</Text>
              <View className="h-[1px] flex-1 bg-gray-100 dark:border-gray-800" />
            </View>
          </>
        )}
      </View>
    );
  }, [clan, isOffline, isDark, pulseAnimatedStyle, spinAnimatedStyle, skeletonAnimatedStyle, isFollowing, loadingFollow, actionLoading, showAlert, handleFollow, handleAuthorRequest, router]);

  const renderItem = useCallback(({ item }) => (
    <View className="px-3">
      <PostCard
        post={item}
        authorData={item.authorData}
        clanData={item.clanData}
        isFeed
      />
    </View>
  ), [clan]);

  if (isInitialMount) {
    return <View style={{ backgroundColor: isDark ? "#050505" : "#ffffff" }} className="flex-1 items-center justify-center"><SyncLoading message='Decrypting Intel' /></View>
  }

  return (
    <View className="flex-1 bg-white dark:bg-[#0a0a0a]">
      <LegendList
        ref={scrollRef}
        data={posts}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}

        estimatedItemSize={500}
        drawDistance={1000}
        recycleItems={true}
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
        onScroll={(e) => { DeviceEventEmitter.emit("onScroll", e.nativeEvent.contentOffset.y); }}
        scrollEventThrottle={16}
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
                <TouchableOpacity
                  onPress={captureAndShare}
                  style={{ backgroundColor: clan ? getClanTierDetails(clan.rank || 1).color : '#3b82f6' }}
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