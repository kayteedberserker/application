import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Video } from "expo-av";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
	Alert,
	Dimensions,
	Image,
	Linking,
	Modal,
	Pressable,
	Share,
	useColorScheme,
	View
} from "react-native";
// 🔹 New Imports for Zooming
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated';
import { WebView } from "react-native-webview";
import YoutubePlayer from "react-native-youtube-iframe";
import useSWR from "swr";
// Components & Context
import { useUser } from "../context/UserContext";
import AppBanner from "./AppBanner";
import Poll from "./Poll";
import { SyncLoading } from "./SyncLoading";
import { Text } from "./Text";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const fetcher = (url) => fetch(url).then((res) => res.json());

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
        const formattedK = kValue % 1 === 0 ? kValue.toFixed(0) : kValue.toFixed(1);
        return `${formattedK}k+`;
    }
    const mValue = views / 1000000;
    const formattedM = mValue % 1 === 0 ? mValue.toFixed(0) : mValue.toFixed(1);
    return `${formattedM}m+`;
};

// --- SKELETON COMPONENTS ---

const MediaSkeleton = ({ height = 250 }) => (
    <View style={{ height, width: '100%' }} className="bg-gray-200 dark:bg-gray-800 items-center justify-center overflow-hidden">
        <SyncLoading message="Initializing Media" />
    </View>
);

export default function PostCard({ post, setPosts, isFeed, hideMedia, similarPosts }) {
    const router = useRouter();
    const { user } = useUser();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";

    const [lightbox, setLightbox] = useState({ open: false, src: null, type: null });
    const [liked, setLiked] = useState(false);
    const [author, setAuthor] = useState({ name: post.authorName, image: null, streak: null });

    const [videoReady, setVideoReady] = useState(false);
    const [tikTokReady, setTikTokReady] = useState(false);
    const [imageReady, setImageReady] = useState(false);

    // 🔹 Reanimated Shared Values for Pro Zoom
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);

    // 1. Pinch Gesture (Zoom)
    const pinchGesture = Gesture.Pinch()
        .onUpdate((event) => {
            scale.value = savedScale.value * event.scale;
        })
        .onEnd(() => {
            if (scale.value < 1) {
                scale.value = withTiming(1);
                translateX.value = withTiming(0);
                translateY.value = withTiming(0);
                savedScale.value = 1;
                savedTranslateX.value = 0;
                savedTranslateY.value = 0;
            } else {
                savedScale.value = scale.value;
            }
        });

    // 2. Pan Gesture (Moving image while zoomed)
    const panGesture = Gesture.Pan()
        .onUpdate((event) => {
            if (scale.value > 1) {
                translateX.value = savedTranslateX.value + event.translationX;
                translateY.value = savedTranslateY.value + event.translationY;
            }
        })
        .onEnd(() => {
            if (scale.value > 1) {
                savedTranslateX.value = translateX.value;
                savedTranslateY.value = translateY.value;
            } else {
                translateX.value = withTiming(0);
                translateY.value = withTiming(0);
                savedTranslateX.value = 0;
                savedTranslateY.value = 0;
            }
        });

    // 3. Double Tap to Reset
    const doubleTapGesture = Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(() => {
            scale.value = withTiming(1);
            translateX.value = withTiming(0);
            translateY.value = withTiming(0);
            savedScale.value = 1;
            savedTranslateX.value = 0;
            savedTranslateY.value = 0;
        });

    // 4. Combine Gestures
    const composed = Gesture.Exclusive(doubleTapGesture, Gesture.Simultaneous(pinchGesture, panGesture));

    // 5. Animated Style (Corrected Transform Order)
    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value },
                { scale: scale.value },
            ],
        };
    });

    const closeLightbox = () => {
        // Reset zoom values before closing
        scale.value = withTiming(1);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        setLightbox({ ...lightbox, open: false });
    };

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
                const res = await fetch(`https://oreblogda.com/api/users/${post.authorId || post.authorUserId}`);
                if (res.ok) {
                    const data = await res.json();
                    setAuthor({
                        name: data.user?.username || post.authorName,
                        image: data.user?.profilePic?.url,
                        streak: data.user?.lastStreak || null
                    });
                }
            } catch (err) {
                console.error("Author fetch err", err);
            }
        };
        if (post.authorId || post.authorUserId) fetchAuthor();
    }, [post.authorId, post.authorUserId, post.authorName]);

    useEffect(() => {
        if (!post?._id || !user?.deviceId) return;
        const handleView = async () => {
            try {
                const viewedKey = "viewedPosts";
                const stored = await AsyncStorage.getItem(viewedKey);
                const viewed = stored ? JSON.parse(stored) : [];
                if (viewed.includes(post._id)) return;
                const res = await fetch(`https://oreblogda.com/api/posts/${post._id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "view", fingerprint: user.deviceId }),
                });
                if (res.ok) {
                    const newViewed = [...viewed, post._id].slice(-200);
                    await AsyncStorage.setItem(viewedKey, JSON.stringify(newViewed));
                    if (typeof mutate === 'function') mutate();
                }
            } catch (err) {
                console.error("View track err:", err);
            }
        };
        handleView();
    }, [post?._id, user?.deviceId]);

    useEffect(() => {
        const checkLocalLikes = async () => {
            try {
                const savedLikes = await AsyncStorage.getItem('user_likes');
                const likedList = savedLikes ? JSON.parse(savedLikes) : [];
                if (likedList.includes(post?._id)) {
                    setLiked(true);
                } else if (user?.deviceId && post.likes?.some(l => l.fingerprint === user.deviceId)) {
                    setLiked(true);
                    const updatedList = [...likedList, post?._id];
                    await AsyncStorage.setItem('user_likes', JSON.stringify(updatedList));
                }
            } catch (e) {
                console.error("Local storage error", e);
            }
        };
        checkLocalLikes();
    }, [post?._id, post.likes, user?.deviceId]);

    const handleLike = async () => {
        if (liked || !user) {
            if (!user) Alert.alert("Hold on", "Please register to interact with posts.");
            router.replace("screens/FirstLaunchScreen");
            return;
        }
        const fingerprint = user?.deviceId;
        try {
            setLiked(true);
            mutate({ ...postData, likes: [...(postData?.likes || []), { fingerprint }] }, false);
            fetch(`https://oreblogda.com/api/posts/${post?._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "like", fingerprint }),
            }).catch(err => console.error("Sync error", err));

            const savedLikes = await AsyncStorage.getItem('user_likes');
            const likedList = savedLikes ? JSON.parse(savedLikes) : [];
            if (!likedList.includes(post?._id)) {
                likedList.push(post?._id);
                await AsyncStorage.setItem('user_likes', JSON.stringify(likedList));
            }
        } catch (err) {
            console.error("Local like logic failed", err);
        }
    };

    const handleNativeShare = async () => {
        try {
            const url = `https://oreblogda.com/post/${post?.slug || post?._id}`;
            await Share.share({
                message: `Check out this post on Oreblogda: ${post?.title}\n${url}`,
                url,
            });
            await fetch(`https://oreblogda.com/api/posts/${post?._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "share", fingerprint: user.deviceId }),
            });
            mutate();
        } catch (error) {
            console.error("Share error", error);
        }
    };

    const parseMessageSections = (msg) => {
        const regex = /\[section\](.*?)\[\/section\]|\[h\](.*?)\[\/h\]|\[li\](.*?)\[\/li\]|\[source="(.*?)" text:(.*?)\]|\[br\]/gs;
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(msg)) !== null) {
            if (match.index > lastIndex) {
                parts.push({ type: "text", content: msg.slice(lastIndex, match.index) });
            }

            if (match[1] !== undefined) parts.push({ type: "section", content: match[1] });
            else if (match[2] !== undefined) parts.push({ type: "heading", content: match[2] });
            else if (match[3] !== undefined) parts.push({ type: "listItem", content: match[3] });
            else if (match[4] !== undefined) parts.push({ type: "link", url: match[4], content: match[5] });
            else parts.push({ type: "br" });

            lastIndex = regex.lastIndex;
        }

        if (lastIndex < msg.length) {
            parts.push({ type: "text", content: msg.slice(lastIndex) });
        }
        return parts;
    };

    const renderContent = useMemo(() => {
        const maxLength = similarPosts ? 200 : 150;

        if (isFeed) {
            const plainText = post.message.replace(/\[section\](.*?)\[\/section\]|\[h\](.*?)\[\/h\]|\[li\](.*?)\[\/li\]|\[source=".*?" text:.*?\]|\[br\]/gs, "");
            const truncated = plainText.length > maxLength ? plainText.slice(0, maxLength) + "..." : plainText;
            return <Text style={{ color: isDark ? "#9ca3af" : "#4b5563" }} className="text-base leading-6">{truncated}</Text>;
        }

        const parts = parseMessageSections(post.message);
        return parts.map((p, i) => {
            switch (p.type) {
                case "text":
                    return (
                        <Text key={i} className="text-base leading-7 text-gray-800 dark:text-gray-200">
                            {p.content}
                        </Text>
                    );

                case "br":
                    return <View key={i} className="h-2" />;

                case "link":
                    return (
                        <Text
                            key={i}
                            onPress={() => Linking.openURL(p.url)}
                            className="text-blue-500 font-bold underline text-base"
                        >
                            {p.content}
                        </Text>
                    );

                case "heading":
                    return (
                        <Text key={i} className="text-xl font-bold mt-4 mb-2 text-black dark:text-white uppercase tracking-tight">
                            {p.content}
                        </Text>
                    );

                case "listItem":
                    return (
                        <View key={i} className="flex-row items-start ml-4 my-1">
                            <Text className="text-blue-500 mr-2 text-lg">•</Text>
                            <Text className="flex-1 text-base leading-6 text-gray-800 dark:text-gray-200">
                                {p.content}
                            </Text>
                        </View>
                    );

                case "section":
                    return (
                        <View
                            key={i}
                            className="bg-gray-100 dark:bg-gray-800/60 p-4 my-3 rounded-2xl border-l-4 border-blue-500"
                        >
                            <Text className="text-base italic leading-6 text-gray-700 dark:text-gray-300">
                                {p.content}
                            </Text>
                        </View>
                    );

                default:
                    return null;
            }
        });
    }, [post.message, isFeed, isDark, similarPosts]);

    const renderMediaContent = () => {
        if (!post?.mediaUrl) return null;
        const lowerUrl = post.mediaUrl.toLowerCase();
        const isYouTube = lowerUrl.includes("youtube.com") || lowerUrl.includes("youtu.be");
        const isTikTok = lowerUrl.includes("tiktok.com");
        const isDirectVideo = post.mediaType?.startsWith("video") || lowerUrl.match(/\.(mp4|mov|m4v)$/i);

        const glassStyle = {
            borderWidth: 1, borderColor: 'rgba(96, 165, 250, 0.2)', shadowColor: "#60a5fa",
            shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 10,
        };

        if (isYouTube) {
            const getYouTubeID = (url) => {
                const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
                const match = url.match(regex);
                return match ? match[1] : null;
            };
            return (
                <View className="w-full rounded-2xl overflow-hidden my-2 bg-black" style={glassStyle}>
                    {!videoReady && <MediaSkeleton height={similarPosts ? 160 : 210} />}
                    <YoutubePlayer
                        height={similarPosts ? 160 : videoReady ? 210 : 0}
                        play={false}
                        videoId={getYouTubeID(post.mediaUrl)}
                        onReady={() => setVideoReady(true)}
                        webViewProps={{ allowsInlineMediaPlayback: true, androidLayerType: "hardware" }}
                    />
                </View>
            );
        }

        if (isTikTok) {
            const getTikTokEmbedUrl = (url) => {
                const match = url.match(/\/video\/(\d+)/);
                return match?.[1] ? `https://www.tiktok.com/embed/${match[1]}` : url;
            };
            return (
                <View className="w-full rounded-2xl overflow-hidden my-2 bg-black" style={[{ height: similarPosts ? 200 : 600 }, glassStyle]}>
                    {!tikTokReady && <MediaSkeleton height={similarPosts ? 200 : 600} />}
                    <WebView
                        source={{ uri: getTikTokEmbedUrl(post.mediaUrl) }}
                        userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)"
                        onLoadEnd={() => setTikTokReady(true)}
                        scrollEnabled={false}
                        allowsFullscreenVideo
                        javaScriptEnabled
                        domStorageEnabled
                        allowsInlineMediaPlayback={true}
                        style={{ flex: 1, opacity: tikTokReady ? 1 : 0 }}
                    />
                </View>
            );
        }

        return (
            <Pressable
                onPress={() => !isDirectVideo && setLightbox({ open: true, src: post.mediaUrl, type: "image" })}
                className="my-2 rounded-2xl overflow-hidden shadow-sm"
                style={[similarPosts ? { height: 200 } : null, glassStyle]}
            >
                {!imageReady && !isDirectVideo && <MediaSkeleton height={300} />}
                {!videoReady && isDirectVideo && <MediaSkeleton height={250} />}
                {isDirectVideo ? (
                    <Video
                        source={{ uri: post.mediaUrl }}
                        style={{ width: "100%", height: videoReady ? 250 : 0 }}
                        useNativeControls
                        resizeMode="cover"
                        onLoad={() => setVideoReady(true)}
                    />
                ) : (
                    <Image
                        source={{ uri: post.mediaUrl }}
                        style={{ width: "100%", height: imageReady ? 300 : 0 }}
                        resizeMode="cover"
                        onLoad={() => setImageReady(true)}
                    />
                )}
            </Pressable>
        );
    };

    return (
        <View className={`mb-8 overflow-hidden rounded-[32px] border ${isDark ? "bg-[#0d1117] border-gray-800" : "bg-white border-gray-100 shadow-sm"}`}>
            <View className="h-[2px] w-full bg-blue-600 opacity-20" />
            <View className="p-4 px-2">
                <View className="flex-row justify-between items-center mb-5">
                    <Pressable onPress={() => router.push(`/author/${post.authorId || post.authorUserId}`)} className="flex-row items-center gap-3">
                        <View className="relative">
                            {author.image ? (
                                <View className="border-2 border-blue-500/30 p-[2px] rounded-full">
                                    <Image source={{ uri: author.image }} className="w-10 h-10 rounded-full bg-gray-200" resizeMode="cover" />
                                </View>
                            ) : (
                                <View className="w-10 h-10 rounded-full bg-blue-600 items-center justify-center">
                                    <Text className="text-white font-black">{author.name?.charAt(0).toUpperCase() || "?"}</Text>
                                </View>
                            )}
                            <View className="absolute bottom-0 right-0 w-3 h-3 bg-blue-600 border-2 border-white dark:border-[#0d1117] rounded-full" />
                        </View>
                        <View>
                            <Text className="font-[900] uppercase tracking-widest text-blue-600 dark:text-blue-400 text-[14px]">
                                {author.name || "Unknown Entity"} - <Ionicons name="flame" size={12} color={author.streak < 0 ? "#ef4444" : "#f97316"} />{author.streak > 0 ? `${author.streak}` : "0"}
                            </Text>
                            <Text className="text-[11px] mt-1 text-gray-900 dark:text-white font-bold uppercase tracking-tighter">{userRank.rankName || "Verified Author"}</Text>
                        </View>
                    </Pressable>
                    <View className="flex-row items-center gap-2 bg-gray-50 dark:bg-gray-800/50 px-3 py-1.5 rounded-full border border-gray-100 dark:border-gray-700">
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
                            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] italic text-center">
                                Sponsored Transmission
                            </Text>
                            <AppBanner size="ANCHORED_ADAPTIVE_BANNER" />
                        </View>
                    )}
                </Pressable>

                <View className="mb-4 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800">{renderMediaContent()}</View>

                {post.poll && (
                    <View className="mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800">
                        <Poll poll={post.poll} postId={post?._id} deviceId={user?.deviceId} />
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

            <Modal visible={lightbox.open} transparent animationType="fade">
                <GestureHandlerRootView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' }}>
                    {/* Close Button Overlay */}
                    <Pressable
                        onPress={closeLightbox}
                        className="absolute top-14 right-6 p-3 bg-white/10 rounded-full z-[100]"
                    >
                        <Feather name="x" size={24} color="white" />
                    </Pressable>

                    <View className="flex-1 justify-center items-center">
                        {lightbox.type === "image" ? (
                            <GestureDetector gesture={composed}>
                                <Animated.Image
                                    source={{ uri: lightbox.src }}
                                    style={[{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8 }, animatedStyle]}
                                    resizeMode="contain"
                                />
                            </GestureDetector>
                        ) : (
                            <Video
                                source={{ uri: lightbox.src }}
                                className="w-full h-[80%]"
                                useNativeControls
                                resizeMode="contain"
                                shouldPlay
                            />
                        )}
                    </View>
                </GestureHandlerRootView>
            </Modal>
        </View>
    );
}
