import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Video, ResizeMode } from "expo-av"; 
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  Alert,
  BackHandler,
  Dimensions,
  Image,
  Linking,
  Modal,
  Pressable,
  Share,
  useColorScheme,
  View,
  Animated,
  Easing
} from "react-native";
import { WebView } from "react-native-webview";
import YoutubePlayer from "react-native-youtube-iframe";
import ImageZoom from 'react-native-image-pan-zoom'; 
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import useSWR from "swr";

// Components & Context
import { useUser } from "../context/UserContext";
import AppBanner from "./AppBanner";
import Poll from "./Poll";
import { SyncLoading } from "./SyncLoading";
import { Text } from "./Text";
import apiFetch from "../utils/apiFetch";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const fetcher = (url) => apiFetch(url).then((res) => res.json());

// 🔹 AURA UI UTILITY (Fully Synced Colors & Icons)
const getAuraVisuals = (rank) => {
  if (!rank || rank > 10 || rank <= 0) return null;
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

const resolveUserRank = (totalPosts) => {
  const count = totalPosts;
  const rankTitle =
    count > 200 ? "Master_Writer" :
    count > 150 ? "Elite_Writer" :
    count > 100 ? "Senior_Writer" :
    count > 50 ? "Novice_Writer" :
    count > 25 ? "Senior_Researcher" :
    "Novice_Researcher";

  const rankIcon =
    count > 200 ? "👑" :
    count > 150 ? "💎" :
    count > 100 ? "🔥" :
    count > 50 ? "⚔️" :
    count > 25 ? "📜" :
    "🛡️";
  return { rankName: rankIcon + rankTitle };
};

const formatViews = (views) => {
  if (!views || views < 0) return "0";
  if (views < 100) return views.toString();
  if (views < 1000) return `${Math.floor(views / 100) * 100}+`;
  if (views < 1000000) {
    const kValue = views / 1000;
    return `${kValue % 1 === 0 ? kValue.toFixed(0) : kValue.toFixed(1)}k+`;
  }
  const mValue = views / 1000000;
  return `${mValue % 1 === 0 ? mValue.toFixed(0) : mValue.toFixed(1)}m+`;
};

// --- SKELETON COMPONENTS ---
const MediaSkeleton = ({ height = 250 }) => (
  <View style={{ height, width: '100%' }} className="bg-gray-200 dark:bg-gray-800 items-center justify-center overflow-hidden">
    <SyncLoading message="Initializing Media" />
  </View>
);

const MediaPlaceholder = ({ height = 250, onPress, type }) => (
  <Pressable
    onPress={onPress}
    style={{ height, width: '100%' }}
    className="bg-gray-100 dark:bg-gray-800/80 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-gray-300 dark:border-gray-700"
  >
    <View className="bg-white/50 dark:bg-black/20 p-4 rounded-full mb-2">
      <Feather name={type === "video" ? "play-circle" : "image"} size={32} color="#60a5fa" />
    </View>
    <Text className="text-gray-500 dark:text-gray-400 font-bold text-xs uppercase tracking-widest">
      Tap to Load {type === "video" ? "Video" : "Image"}
    </Text>
    <Text className="text-gray-400 dark:text-gray-600 text-[10px] mt-1">Data Saver Mode</Text>
  </Pressable>
);

export default function PostCard({ post, setPosts, isFeed, hideMedia, similarPosts }) {
  const router = useRouter();
  const { user } = useUser();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [lightbox, setLightbox] = useState({ open: false, src: null, type: null });
  const [liked, setLiked] = useState(false);
  const [author, setAuthor] = useState({ name: post.authorName, image: null, streak: null, rank: null });

  // Media States
  const [loadMedia, setLoadMedia] = useState(false); 
  const [videoReady, setVideoReady] = useState(false);
  const [tikTokReady, setTikTokReady] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [videoAspectRatio, setVideoAspectRatio] = useState(16 / 9);

  // 🔹 ANIMATION REFS
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 2500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2500, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(rotationAnim, {
        toValue: 1,
        duration: 10000,
        easing: Easing.linear,
        useNativeDriver: true
      })
    ).start();
  }, []);

  const spin = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const closeLightbox = () => {
    setLightbox((prev) => ({ ...prev, open: false }));
    return true;
  };

  useEffect(() => {
    const backAction = () => {
      if (lightbox.open) {
        closeLightbox();
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, [lightbox.open]);

  const { data: postData, mutate } = useSWR(
    post?._id ? `https://oreblogda.com/api/posts/${post._id}` : null,
    fetcher,
    { refreshInterval: 10000 }
  );

  const totalLikes = postData?.likes?.length || 0;
  const totalComments = postData?.comments?.length || 0;
  const totalViews = postData?.views || 0;
  const totalAuthorPost = postData?.authorPostCount || 0;
  const userRank = useMemo(() => resolveUserRank(totalAuthorPost), [totalAuthorPost]);

  useEffect(() => {
    const fetchAuthor = async () => {
      try {
        const res = await apiFetch(`https://oreblogda.com/api/users/${post.authorUserId}`);
        if (res.ok) {
          const data = await res.json();
          setAuthor({
            name: data.user?.username || post.authorName,
            image: data.user?.profilePic?.url,
            streak: data.user?.lastStreak || null,
            rank: data.user?.previousRank || 0
          });
        }
      } catch (err) {
        console.error("Author fetch err", err);
      }
    };
    if (post.authorId || post.authorUserId) fetchAuthor();
  }, [post.authorId, post.authorUserId]);

  // View Tracking & Like logic (Existing implementation maintained)
  useEffect(() => {
    if (!post?._id || !user?.deviceId) return;
    const handleView = async () => {
      try {
        const viewedKey = "viewedPosts";
        const stored = await AsyncStorage.getItem(viewedKey);
        const viewed = stored ? JSON.parse(stored) : [];
        if (viewed.includes(post._id)) return;
        const res = await apiFetch(`https://oreblogda.com/api/posts/${post._id}`, {
          method: "PATCH",
          body: JSON.stringify({ action: "view", fingerprint: user.deviceId }),
        });
        if (res.ok) {
          const newViewed = [...viewed, post._id].slice(-200);
          await AsyncStorage.setItem(viewedKey, JSON.stringify(newViewed));
          if (typeof mutate === 'function') mutate();
        }
      } catch (err) { console.error("View track err:", err); }
    };
    handleView();
  }, [post?._id, user?.deviceId]);

  useEffect(() => {
    const checkLocalLikes = async () => {
      try {
        const savedLikes = await AsyncStorage.getItem('user_likes');
        const likedList = savedLikes ? JSON.parse(savedLikes) : [];
        if (likedList.includes(post?._id)) setLiked(true);
      } catch (e) { console.error("Local storage error", e); }
    };
    checkLocalLikes();
  }, [post?._id]);

  const handleLike = async () => {
    if (liked || !user) {
      if (!user) {
        Alert.alert("Hold on", "Please register to interact with posts.");
        router.replace("screens/FirstLaunchScreen");
      }
      return;
    }
    const fingerprint = user?.deviceId;
    try {
      setLiked(true);
      mutate({ ...postData, likes: [...(postData?.likes || []), { fingerprint }] }, false);
      apiFetch(`https://oreblogda.com/api/posts/${post?._id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "like", fingerprint }),
      });
      const savedLikes = await AsyncStorage.getItem('user_likes');
      const likedList = savedLikes ? JSON.parse(savedLikes) : [];
      if (!likedList.includes(post?._id)) {
        likedList.push(post?._id);
        await AsyncStorage.setItem('user_likes', JSON.stringify(likedList));
      }
    } catch (err) { console.error("Local like logic failed", err); }
  };

  const handleNativeShare = async () => {
    try {
      const url = `https://oreblogda.com/post/${post?.slug || post?._id}`;
      await Share.share({ message: `Check out this post on Oreblogda: ${post?.title}\n${url}` });
      apiFetch(`https://oreblogda.com/api/posts/${post?._id}`, { method: "PATCH", body: JSON.stringify({ action: "share", fingerprint: user.deviceId }) });
      mutate();
    } catch (error) { console.error("Share error", error); }
  };

  const parseCustomSyntax = (text) => {
    if (!text) return [];
    const regex = /s\((.*?)\)|\[section\](.*?)\[\/section\]|h\((.*?)\)|\[h\](.*?)\[\/h\]|l\((.*?)\)|\[li\](.*?)\[\/li\]|link\((.*?)\)-text\((.*?)\)|\[source="(.*?)" text:(.*?)\]|br\(\)|\[br\]/gs;
    const parts = [];
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
      if (match[1] || match[2]) parts.push({ type: 'section', content: match[1] || match[2] });
      else if (match[3] || match[4]) parts.push({ type: 'heading', content: match[3] || match[4] });
      else if (match[5] || match[6]) parts.push({ type: 'listItem', content: match[5] || match[6] });
      else if (match[7] && match[8]) parts.push({ type: 'link', url: match[7], content: match[8] });
      else if (match[9] && match[10]) parts.push({ type: 'link', url: match[9], content: match[10] });
      else if (match[0] === 'br()' || match[0] === '[br]') parts.push({ type: 'br' });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) parts.push({ type: 'text', content: text.slice(lastIndex) });
    return parts;
  };

  const renderContent = useMemo(() => {
    const maxLength = similarPosts ? 200 : 150;
    if (isFeed) {
      const plainText = post.message
        .replace(/s\((.*?)\)|\[section\](.*?)\[\/section\]|h\((.*?)\)|\[h\](.*?)\[\/h\]|l\((.*?)\)|\[li\](.*?)\[\/li\]|link\((.*?)\)-text\((.*?)\)|\[source="(.*?)" text:(.*?)\]|br\(\)|\[br\]/gs, (match, p1, p2, p3, p4, p5, p6, p8, p10) => p1 || p2 || p3 || p4 || p5 || p6 || p8 || p10 || '')
        .trim();
      const truncated = plainText.length > maxLength ? plainText.slice(0, maxLength) + "..." : plainText;
      return <Text style={{ color: isDark ? "#9ca3af" : "#4b5563" }} className="text-base leading-6">{truncated}</Text>;
    }
    const parts = parseCustomSyntax(post.message);
    return parts.map((part, i) => {
      switch (part.type) {
        case "text": return <Text key={i} className="text-base leading-7 text-gray-800 dark:text-gray-200">{part.content}</Text>;
        case "br": return <View key={i} className="h-2" />;
        case "link": return <Text key={i} onPress={() => Linking.openURL(part.url)} className="text-blue-500 font-bold underline text-base">{part.content}</Text>;
        case "heading": return <Text key={i} className="text-xl font-bold mt-4 mb-2 text-black dark:text-white uppercase tracking-tight">{part.content}</Text>;
        case "listItem": return <View key={i} className="flex-row items-start ml-4 my-1"><Text className="text-blue-500 mr-2 text-lg">•</Text><Text className="flex-1 text-base leading-6 text-gray-800 dark:text-gray-200">{part.content}</Text></View>;
        case "section": return <View key={i} className="bg-gray-100 dark:bg-gray-800/60 p-4 my-3 rounded-2xl border-l-4 border-blue-500"><Text className="text-base italic leading-6 text-gray-700 dark:text-gray-300">{part.content}</Text></View>;
        default: return null;
      }
    });
  }, [post.message, isFeed, isDark, similarPosts]);

  const renderMediaContent = () => {
    if (!post?.mediaUrl) return null;
    const lowerUrl = post.mediaUrl.toLowerCase();
    const isYouTube = lowerUrl.includes("youtube.com") || lowerUrl.includes("youtu.be");
    const isTikTok = lowerUrl.includes("tiktok.com");
    const isDirectVideo = post.mediaType?.startsWith("video") || lowerUrl.match(/\.(mp4|mov|m4v|webm)$/i);
    const isVideo = isYouTube || isTikTok || isDirectVideo;

    if (!loadMedia && isVideo) {
      return (
        <View className="my-2">
          <MediaPlaceholder height={similarPosts ? 160 : 250} type="video" onPress={() => setLoadMedia(true)} />
        </View>
      );
    }

    const glassStyle = { borderWidth: 1, borderColor: 'rgba(96, 165, 250, 0.2)', shadowColor: "#60a5fa", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 10 };

    if (isYouTube) {
      const getYouTubeID = (url) => {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
      };
      return <View className="w-full rounded-2xl overflow-hidden my-2 bg-black" style={glassStyle}>{!videoReady && <MediaSkeleton height={similarPosts ? 160 : 210} />}<YoutubePlayer height={similarPosts ? 160 : videoReady ? 210 : 0} play={false} videoId={getYouTubeID(post.mediaUrl)} onReady={() => setVideoReady(true)} webViewProps={{ allowsInlineMediaPlayback: true, androidLayerType: "hardware" }}/></View>;
    }

    if (isTikTok) {
      const getTikTokEmbedUrl = (url) => {
        const match = url.match(/\/video\/(\d+)/);
        return match?.[1] ? `https://www.tiktok.com/embed/${match[1]}` : url;
      }
      return <View className="w-full rounded-2xl overflow-hidden my-2 bg-black" style={[{ height: similarPosts ? 200 : 600 }, glassStyle]}>{!tikTokReady && <MediaSkeleton height={similarPosts ? 200 : 600} />}<WebView source={{ uri: getTikTokEmbedUrl(post.mediaUrl) }} userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)" onLoadEnd={() => setTikTokReady(true)} scrollEnabled={false} allowsFullscreenVideo javaScriptEnabled domStorageEnabled allowsInlineMediaPlayback={true} style={{ flex: 1, opacity: tikTokReady ? 1 : 0 }}/></View>;
    }

    return (
      <View className="my-2 rounded-2xl overflow-hidden shadow-sm" style={[{ width: '100%', backgroundColor: 'black' }, glassStyle]}>
        {!imageReady && !isDirectVideo && <MediaSkeleton height={300} />}
        {!videoReady && isDirectVideo && <MediaSkeleton height={similarPosts ? 200 : 250} />}
        {isDirectVideo ? (
          <Video 
            source={{ uri: post.mediaUrl }} 
            style={{ width: "100%", aspectRatio: videoAspectRatio, maxHeight: similarPosts ? 200 : 500 }} 
            useNativeControls 
            resizeMode={ResizeMode.CONTAIN} 
            isMuted={false}
            onLoad={(data) => {
              if (data.naturalSize) setVideoAspectRatio(data.naturalSize.width / data.naturalSize.height);
              setVideoReady(true);
            }}
          />
        ) : (
          <Pressable onPress={() => setLightbox({ open: true, src: post.mediaUrl, type: "image" })}>
            <Image source={{ uri: post.mediaUrl }} style={{ width: "100%", height: imageReady ? 300 : 0 }} resizeMode="cover" onLoad={() => setImageReady(true)} />
          </Pressable>
        )}
      </View>
    );
  };

  const aura = getAuraVisuals(author.rank);
  const isTop3 = author.rank > 0 && author.rank <= 3;
  const isTop10 = author.rank > 0 && author.rank <= 10;

  const getRankedFrameStyle = () => {
    if (author.rank === 1) return { borderRadius: 14, transform: [{ rotate: '45deg' }], borderWidth: 2 };
    if (author.rank === 2) return { borderRadius: 25, borderWidth: 2 };
    if (author.rank === 3) return { borderRadius: 8, borderWidth: 1.5 };
    return { borderRadius: 100, borderWidth: 1 };
  };

  return (
    <View className={`mb-8 overflow-hidden rounded-[32px] border ${isDark ? "bg-[#0d1117] border-gray-800" : "bg-white border-gray-100 shadow-sm"}`}>
      {isTop3 && (
        <View className="absolute inset-0 opacity-[0.04]" style={{ backgroundColor: aura.color }} />
      )}

      <View className="h-[2px] w-full bg-blue-600 opacity-20" />
      <View className="p-4 px-2">
        <View className="flex-row justify-between items-start mb-5">
          <Pressable onPress={() => router.push(`/author/${post.authorUserId}`)} className="flex-row items-center gap-3 flex-1 pr-2">
            
            {/* 🔹 ANIMATED PROFILE PIC SECTION */}
            <View className="relative shrink-0 w-14 h-14 items-center justify-center">
              
              {/* Rotating Outer Frame (Top 3 only) */}
              {isTop10 && author.rank <= 3 && (
                <Animated.View 
                  style={[
                    getRankedFrameStyle(),
                    { 
                      position: 'absolute', width: 56, height: 56, borderColor: aura.color, 
                      borderStyle: 'dashed', opacity: 0.6,
                      transform: [...getRankedFrameStyle().transform || [], { rotate: spin }]
                    }
                  ]}
                />
              )}

              {/* Pulsing Glow Frame (All Top 10) */}
              {isTop10 && (
                <Animated.View 
                  style={[
                    getRankedFrameStyle(),
                    { 
                      position: 'absolute', width: 50, height: 50, borderColor: aura.color, 
                      opacity: 0.3, transform: [...getRankedFrameStyle().transform || [], { scale: pulseAnim }]
                    }
                  ]}
                />
              )}

              {/* Main Avatar Container */}
              <View style={[getRankedFrameStyle(), { width: 44, height: 44, borderColor: isTop10 ? aura.color : 'rgba(96, 165, 250, 0.3)', overflow: 'hidden', backgroundColor: isDark ? '#1a1d23' : '#f3f4f6' }]}>
                {author.image ? (
                  <Image 
                    source={{ uri: author.image }} 
                    className="w-full h-full bg-gray-200" 
                    resizeMode="cover" 
                    style={author.rank === 1 ? { transform: [{ rotate: '-45deg' }], scale: 1.4 } : {}} 
                  />
                ) : (
                  <View className="flex-1 items-center justify-center" style={{ backgroundColor: isTop10 ? aura.color : '#2563eb' }}>
                    <Text className="text-white font-black">{author.name?.charAt(0).toUpperCase() || "?"}</Text>
                  </View>
                )}
              </View>

              {/* Status Dot */}
              <View style={{ backgroundColor: isTop10 ? aura.color : '#2563eb' }} className="absolute bottom-1 right-1 w-3.5 h-3.5 border-2 border-white dark:border-[#0d1117] rounded-full shadow-sm" />
            </View>

            <View className="flex-1">
              <View className="flex-row items-center gap-1 flex-wrap">
                <Text style={{ color: isTop10 ? aura.color : (isDark ? "#60a5fa" : "#2563eb") }} className="font-[900] uppercase tracking-widest text-[14px]">
                  {author.name || "Unknown Entity"} 
                </Text>
                
                {/* 🛡️ RANK BADGE (Now visible on all pages) */}
                

                <Text className="text-gray-500 font-normal normal-case tracking-normal"> • </Text>
                <Ionicons name="flame" size={12} color={author.streak < 0 ? "#ef4444" : "#f97316"} />
                <Text className="text-gray-500 text-[11px] font-bold">{author.streak || "0"}</Text>
              </View>
                  {isTop10 && (
                  <View className="bg-white/10 px-1.5 py-0.5 w-fit rounded border flex-row items-center gap-1" style={{ borderColor: aura.color + '40' }}>
                    <MaterialCommunityIcons name={aura.icon} size={8} color={aura.color} />
                    <Text style={{ color: aura.color, fontSize: 7, fontWeight: '900' }}>{aura.label}</Text>
                  </View>
                )}
              <Text className="text-[11px] mt-1 text-gray-900 dark:text-white font-bold uppercase tracking-tighter">{userRank.rankName || "Verified Author"}</Text>
            </View>
          </Pressable>

          <View className="shrink-0 flex-row items-center gap-2 bg-gray-50 dark:bg-gray-800/50 px-3 py-1.5 rounded-full border border-gray-100 dark:border-gray-700">
            <View className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            <Text className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest">{formatViews(totalViews)}</Text>
          </View>
        </View>

        <Pressable onPress={() => isFeed && router.push(`/post/${post.slug || post?._id}`)} className="mb-4">
          <Text className={`font-[900] uppercase italic tracking-tighter leading-tight mb-2 ${isDark ? "text-white" : "text-gray-900"} ${isFeed ? "text-2xl" : "text-3xl"}`}>
            {post?.title}
          </Text>
          <View className="opacity-90">{renderContent}</View>
          {!isFeed && (
            <View className="mb-3 mt-3 w-full p-6 border border-dashed border-gray-300 dark:border-gray-800 rounded-[32px] bg-gray-50/50 dark:bg-white/5 items-center justify-center">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] italic text-center">Sponsored Transmission</Text>
              <AppBanner size="ANCHORED_ADAPTIVE_BANNER" />
            </View>
          )}
        </Pressable>

        <View className="mb-4 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800">{renderMediaContent()}</View>

        {post.poll && (
          <View className={similarPosts ? "mt-2 pt-3 border-t border-gray-200 dark:border-gray-800" : "mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800"}>
            {similarPosts ? (
               <View className="flex-row px-3 items-center gap-2">
                 <MaterialCommunityIcons name="poll" size={20} color={isDark ? "#60a5fa" : "#3b82f6"} />
                 <Text className="text-sm font-black text-gray-500 uppercase tracking-widest">Includes a poll</Text>
               </View>
            ) : (
              <Poll poll={post.poll} postId={post?._id} deviceId={user?.deviceId} />
            )}
          </View>
        )}

        {similarPosts ? null : (
          <View className="flex-row items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-4 mt-2">
            <View className="flex-row items-center gap-6">
              <Pressable onPress={handleLike} disabled={liked} className="flex-row items-center gap-2">
                <Ionicons name={liked ? "heart" : "heart-outline"} size={20} color={liked ? "#ef4444" : isDark ? "#9ca3af" : "#4b5563"} />
                <Text className={`text-xs font-black ${liked ? "text-red-500" : "text-gray-500"}`}>{totalLikes}</Text>
              </Pressable>
              <View className="flex-row items-center gap-2">
                <MaterialCommunityIcons name="comment-text-outline" size={18} color={isDark ? "#9ca3af" : "#4b5563"} />
                <Text className="text-xs font-black text-gray-500">{totalComments}</Text>
              </View>
            </View>
            <Pressable onPress={handleNativeShare} className="w-10 h-10 items-center justify-center bg-gray-50 dark:bg-gray-800/80 rounded-full border border-gray-200 dark:border-gray-700">
              <Feather name="share-2" size={16} color={isDark ? "#60a5fa" : "#2563eb"} />
            </Pressable>
          </View>
        )}
      </View>

      {/* LIGHTBOX MODAL (Existing implementation) */}
      <Modal visible={lightbox.open} transparent animationType="fade" onRequestClose={closeLightbox}>
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: 'black' }}>
          <ImageZoom cropWidth={SCREEN_WIDTH} cropHeight={SCREEN_HEIGHT} imageWidth={SCREEN_WIDTH} imageHeight={SCREEN_HEIGHT} onSwipeDown={closeLightbox} enableSwipeDown={true}>
            <Image style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }} source={{ uri: lightbox.src }} resizeMode="contain" />
          </ImageZoom>
          <Pressable onPress={closeLightbox} className="absolute top-14 right-6 p-3 bg-black/40 rounded-full"><Feather name="x" size={24} color="white" /></Pressable>
        </GestureHandlerRootView>
      </Modal>
    </View>
  );
}
