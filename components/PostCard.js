import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from "expo-image";
import * as MediaLibrary from 'expo-media-library';
import { useVideoPlayer, VideoView } from "expo-video";
import { memo, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    BackHandler,
    DeviceEventEmitter,
    Dimensions,
    Linking,
    Modal,
    Pressable,
    Share,
    useColorScheme,
    View
} from "react-native";
import ImageZoom from 'react-native-image-pan-zoom';
import { useMMKV } from 'react-native-mmkv';
import { WebView } from "react-native-webview";
import YoutubePlayer from "react-native-youtube-iframe";
import useSWR from "swr";

import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { SvgXml } from "react-native-svg";
import { useAlert } from "../context/AlertContext";
import { useUser } from "../context/UserContext";
import apiFetch from "../utils/apiFetch";
import AuraAvatar from "./AuraAvatar";
import BadgeIcon from "./BadgeIcon";
import ClanBorder from "./ClanBorder";
import ClanCrest from "./ClanCrest";
import PeakBadge from "./PeakBadge";
import PlayerBackground from "./PlayerBackground";
import PlayerNameplate from "./PlayerNameplate";
import PlayerWatermark from "./PlayerWatermark";
import Poll from "./Poll";
import { SyncLoading } from "./SyncLoading";
import { Text } from "./Text";
import THEME from "./useAppTheme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const fetcher = (url) => apiFetch(url).then((res) => res.json());

const getClanRankTitle = (rank) => {
    switch (rank) {
        case 1: return "Wandering Ronin";
        case 2: return "Squad 13";
        case 3: return "Upper Moon";
        case 4: return "Phantom Troupe";
        case 5: return "The Espada";
        case 6: return "The Akatsuki";
        default: return "Wandering Ronin";
    }
};

const getAuraVisuals = (rank) => {
    if (!rank || rank > 10 || rank <= 0) return null;
    switch (rank) {
        case 1: return { color: '#fbbf24', label: 'MONARCH', icon: 'crown' };
        case 2: return { color: '#ef4444', label: 'YONKO', icon: 'flare' };
        case 3: return { color: '#a855f7', label: 'KAGE', icon: 'moon-waxing-crescent' };
        case 4: return { color: '#3b82f6', label: 'SHOGUN', icon: 'shield-star' };
        case 5: return { color: '#e0f2fe', label: 'ESPADA 0', icon: 'skull' };
        case 6: return { color: '#cbd5e1', label: 'ESPADA 1', icon: 'sword-cross' };
        case 7: return { color: '#94a3b8', label: 'ESPADA 2', icon: 'sword-cross' };
        case 8: return { color: '#64748b', label: 'ESPADA 3', icon: 'sword-cross' };
        case 9: return { color: '#475569', label: 'ESPADA 4', icon: 'sword-cross' };
        case 10: return { color: '#334155', label: 'ESPADA 5', icon: 'sword-cross' };
        default: return { color: '#1e293b', label: 'OPERATIVE', icon: 'target' };
    }
};

const AURA_TIERS = [
    { level: 1, req: 0, title: "E-Rank Novice", icon: "🌱", postLimit: 2 },
    { level: 2, req: 100, title: "D-Rank Operative", icon: "⚔️", postLimit: 2 },
    { level: 3, req: 300, title: "C-Rank Awakened", icon: "🔥", postLimit: 3 },
    { level: 4, req: 700, title: "B-Rank Elite", icon: "⚡", postLimit: 3 },
    { level: 5, req: 1500, title: "A-Rank Champion", icon: "🛡️", postLimit: 4 },
    { level: 6, req: 3000, title: "S-Rank Legend", icon: "🌟", postLimit: 4 },
    { level: 7, req: 6000, title: "SS-Rank Mythic", icon: "🌀", postLimit: 5 },
    { level: 8, req: 12000, title: "Monarch", icon: "👑", postLimit: 5 }, // Max
];

const resolveUserRank = (level) => {
    // Fallback to level 1 if something goes wrong, cap at 8
    const safeLevel = Math.max(1, Math.min(8, level || 1));
    // Arrays are 0-indexed, so level 1 is index 0
    const currentTier = AURA_TIERS[safeLevel - 1];

    return {
        level: currentTier.level,
        rankTitle: currentTier.title,
        rankIcon: currentTier.icon,
        postLimit: currentTier.postLimit,

        // Formatted exactly how you had it before for backward compatibility
        rankName: `${currentTier.icon} ${currentTier.title}`
    };
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

const getVideoThumbnail = (url) => {
    if (!url) return null;
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
        const id = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
        return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
    }
    return url.replace("/q_auto,vc_auto/", "/f_jpg,q_auto,so_auto,c_pad,b_black/").replace(/\.[^/.]+$/, ".jpg");
};

const MediaPlaceholder = ({ height = 250, onPress, type, thumbUrl, showPlayIcon = true }) => (
    <Pressable
        onPress={onPress}
        style={{ height, width: '100%' }}
        className="bg-gray-100 dark:bg-gray-900 items-center justify-center overflow-hidden rounded-2xl relative"
    >
        {thumbUrl ? (
            <Image source={{ uri: thumbUrl }} style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.6 }} contentFit="cover" />
        ) : null}
        {showPlayIcon && (
            <View className="bg-black/40 p-5 rounded-full mb-2 border border-white/20 z-10">
                <Feather name={type === "video" ? "play" : "image"} size={32} color="white" />
            </View>
        )}
        <View className="bg-black/60 px-4 py-1 rounded-full border border-white/10 z-10">
            <Text className="text-white font-black text-[10px] uppercase tracking-[0.2em]">
                Open {type === "video" ? "Stream" : "Visual"}
            </Text>
        </View>
    </Pressable>
);

const RemoteSvgIcon = ({ xml, size = 50, color }) => {
    if (!xml) return <MaterialCommunityIcons name="help-circle-outline" size={size} color="gray" />;
    return <SvgXml xml={xml} width={size} height={size} />;
};

const LightboxVideoPlayer = ({ uri }) => {
    const player = useVideoPlayer(uri, (p) => {
        p.loop = true;
        p.play();
    });

    return (
        <VideoView player={player} style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8 }} contentFit="contain" fullscreenOptions allowsPictureInPicture />
    );
};

const MediaModal = ({ isOpen, onClose, mediaItems, currentIndex, setCurrentIndex, handleDownload, isDownloading, isMediaSaved }) => {
    const [assetLoading, setAssetLoading] = useState(false);

    const goToNext = () => { if (currentIndex < mediaItems.length - 1) setCurrentIndex(currentIndex + 1); };
    const goToPrev = () => { if (currentIndex > 0) setCurrentIndex(currentIndex - 1); };

    const renderLightboxContent = (item) => {
        const lowerUrl = item.url?.toLowerCase() || "";
        const isYouTube = lowerUrl.includes("youtube.com") || lowerUrl.includes("youtu.be");
        const isTikTok = lowerUrl.includes("tiktok.com");
        const isDirectVideo = item.type?.startsWith("video") || lowerUrl.match(/\.(mp4|mov|m4v|webm)$/i);

        if (isYouTube) {
            const getYouTubeID = (url) => {
                const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
                const match = url.match(regex);
                return match ? match[1] : null;
            };
            return (
                <View style={{ width: SCREEN_WIDTH, height: 250, backgroundColor: 'black' }}>
                    <YoutubePlayer height={250} play={true} videoId={getYouTubeID(item.url)} />
                </View>
            );
        }

        if (isTikTok) {
            const getTikTokEmbedUrl = (url) => {
                const match = url.match(/\/video\/(\d+)/);
                return match?.[1] ? `https://www.tiktok.com/embed/${match[1]}` : url;
            }
            return (
                <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.7 }}>
                    <WebView source={{ uri: getTikTokEmbedUrl(item.url) }} userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)" scrollEnabled={false} allowsFullscreenVideo javaScriptEnabled domStorageEnabled allowsInlineMediaPlayback={true} style={{ flex: 1, backgroundColor: 'black' }} />
                </View>
            );
        }

        if (isDirectVideo) {
            return <LightboxVideoPlayer key={item.url} uri={item.url} />;
        }

        return (
            <View style={{ flex: 1, backgroundColor: 'black' }}>
                <ImageZoom
                    cropWidth={SCREEN_WIDTH}
                    cropHeight={SCREEN_HEIGHT}
                    imageWidth={SCREEN_WIDTH}
                    imageHeight={SCREEN_HEIGHT}
                    panToMove={true}
                    pinchToZoom={true}
                    enableSwipeDown={true}
                    onSwipeDown={onClose}
                    style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
                >
                    <Image
                        style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
                        source={{ uri: item.url }}
                        contentFit="contain"
                        onLoadStart={() => setAssetLoading(true)}
                        onLoadEnd={() => setAssetLoading(false)}
                    />
                </ImageZoom>
                {assetLoading && <View className="absolute inset-0 items-center justify-center bg-black/20"><SyncLoading message="Synchronizing Visuals" /></View>}
            </View>
        );
    };

    return (
        <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
            <View style={{ flex: 1, backgroundColor: 'black' }}>
                <View className="flex-1 justify-center items-center">
                    {mediaItems[currentIndex] && renderLightboxContent(mediaItems[currentIndex])}
                </View>

                {mediaItems.length > 1 && (
                    <>
                        {currentIndex > 0 && (
                            <Pressable onPress={goToPrev} className="absolute left-4 top-1/2 -translate-y-1/2 p-4 bg-black/50 rounded-full z-50 border border-white/10"><Feather name="chevron-left" size={28} color="white" /></Pressable>
                        )}
                        {currentIndex < mediaItems.length - 1 && (
                            <Pressable onPress={goToNext} className="absolute right-4 top-1/2 -translate-y-1/2 p-4 bg-black/50 rounded-full z-50 border border-white/10"><Feather name="chevron-right" size={28} color="white" /></Pressable>
                        )}
                    </>
                )}

                <Pressable onPress={onClose} className="absolute top-14 right-6 p-3 bg-black/40 rounded-full z-50"><Feather name="x" size={24} color="white" /></Pressable>

                {mediaItems[currentIndex]?.type !== "youtube" && (
                    <Pressable onPress={handleDownload} disabled={isDownloading || isMediaSaved} className="absolute top-14 left-6 p-3 bg-black/40 rounded-full z-50 flex-row items-center gap-2">
                        {isDownloading ? <ActivityIndicator size="small" color="#60a5fa" /> : <Feather name={isMediaSaved ? "check" : "download"} size={24} color="white" />}
                    </Pressable>
                )}

                {mediaItems.length > 1 && (
                    <View className="absolute bottom-12 w-full items-center">
                        <View className="bg-black/60 px-6 py-2 rounded-full border border-white/10">
                            <Text className="text-white font-black tracking-widest uppercase text-xs">Asset {currentIndex + 1} / {mediaItems.length}</Text>
                        </View>
                    </View>
                )}
            </View>
        </Modal>
    );
};

const MemoizedClanHeader = memo(({ clanInfo, postId, isDark }) => {
    if (!clanInfo) return null;

    const isVerified = clanInfo.verifiedUntil && new Date(clanInfo.verifiedUntil) > new Date();
    const verifiedTier = clanInfo.activeCustomizations?.verifiedTier;
    const verifiedColor = verifiedTier === "premium" ? "#facc15" : verifiedTier === "standard" ? "#ef4444" : verifiedTier === "basic" ? "#3b82f6" : "";
    const highlightColor = isVerified ? verifiedColor : THEME.accent;

    const equippedBadges = clanInfo.specialInventory?.filter(i => i.category === 'BADGE' && i.isEquipped) || [];
    const displayBadge = equippedBadges.length > 0 ? equippedBadges[0] : null;

    const equippedGlow = clanInfo.specialInventory?.find(i => i.category === 'GLOW' && i.isEquipped);
    const activeGlowColor = equippedGlow?.visualConfig?.primaryColor || equippedGlow?.visualData?.glowColor || null;

    const equippedBg = clanInfo.specialInventory?.find(i => i.category === 'BACKGROUND' && i.isEquipped);
    const equippedBorder = clanInfo.specialInventory?.find(i => i.category === 'BORDER' && i.isEquipped);
    const borderVisual = equippedBorder?.visualConfig || equippedBorder?.visualData || {};

    const borderActiveColor = borderVisual.primaryColor || borderVisual.color || "#ff0000";
    const borderSecondaryColor = borderVisual.secondaryColor || null;
    const animationType = borderVisual.animationType || "singleSnake";
    const snakeLength = borderVisual.snakeLength || 120;
    const animDuration = borderVisual.duration || 3000;

    const CardContent = (
        <View
            style={{ backgroundColor: THEME.card, borderColor: equippedBorder ? 'transparent' : THEME.border }}
            className="flex-row items-center justify-between px-4 py-4 rounded-[28px] border-2 relative overflow-hidden"
        >
            <PlayerBackground
                equippedBg={equippedBg}
                themeColor={activeGlowColor || '#22c55e'}
                borderRadius={28}
            />

            {displayBadge && (
                <View className="absolute -right-2 -top-4 opacity-[0.4] pointer-events-none">
                    <BadgeIcon badge={displayBadge} size={80} containerStyle="bg-transparent border-0" />
                </View>
            )}

            <Pressable onPress={() => DeviceEventEmitter.emit("navigateSafely", `/clans/${clanInfo.tag}`)} className="flex-row items-center flex-1 z-10">
                <View className="mr-4">
                    <ClanCrest isFeed={true} rank={clanInfo.rank} size={48} glowColor={activeGlowColor} />
                </View>
                <View>
                    <View className="flex-row gap-1 items-center">
                        <PlayerNameplate
                            author={{ username: clanInfo.name }} // We pass the clan name as the username
                            themeColor={THEME.text}
                            equippedGlow={equippedGlow} // Use the clan's glow config
                            fontSize={16}
                            showPeakBadge={false}
                            showFlame={false}
                            isDark={isDark}
                        />
                        {isVerified && <RemoteSvgIcon size={24} xml={clanInfo.activeCustomizations?.verifiedBadgeXml} />}
                    </View>
                    <View className="flex-row items-center mt-1">
                        <View style={{ backgroundColor: highlightColor }} className="w-1 h-3 mr-2 rounded-full" />
                        <Text style={{ color: THEME.textSecondary }} className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-70">
                            {getClanRankTitle(clanInfo.rank)}
                        </Text>
                    </View>
                </View>
            </Pressable>

            <View className="flex-row items-center z-10 pl-4 border-l border-white/5">
                {displayBadge && (
                    <View className="mr-[7px] items-center justify-center">
                        <BadgeIcon badge={displayBadge} size={22} />
                    </View>
                )}

                {clanInfo.isInWar ? (
                    <View className="items-center">
                        <View className="bg-red-500 p-2 rounded-xl rotate-45 shadow-sm shadow-red-500/50">
                            <View className="-rotate-45"><MaterialCommunityIcons name="sword-cross" size={18} color="white" /></View>
                        </View>
                        <Text className="text-[8px] text-red-500 font-black uppercase mt-2 tracking-widest">In Battle</Text>
                    </View>
                ) : (
                    <View className="items-end">
                        <View className="flex-row items-center">
                            <Text style={{ color: THEME.text }} className="text-[15px] font-black italic">{clanInfo.followerCount || "0"}</Text>
                            <MaterialCommunityIcons name="account-group" size={15} color={THEME.textSecondary} style={{ marginLeft: 4, opacity: 0.5 }} />
                        </View>
                    </View>
                )}
            </View>
        </View>
    );

    return (
        <View className="mb-4">
            {equippedBorder ? (
                <ClanBorder color={borderActiveColor} secondaryColor={borderSecondaryColor} animationType={animationType} snakeLength={snakeLength} duration={animDuration}>
                    {CardContent}
                </ClanBorder>
            ) : CardContent}
        </View>
    );
});

// ⚡️ MAIN COMPONENT
const PostCardComponent = ({ post, authorData, clanData, setPosts, isFeed, hideMedia, syncing, isVisible = true }) => {
    const CustomAlert = useAlert();
    const { user } = useUser();
    const isDark = useColorScheme() === "dark";

    const storage = useMMKV();

    const [lightbox, setLightbox] = useState({ open: false, index: 0 });
    const [currentAssetIndex, setCurrentAssetIndex] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);
    const [liked, setLiked] = useState(false);
    const [isMediaSaved, setIsMediaSaved] = useState(false);

    const author = authorData || {
        name: post?.authorName || "Unknown",
        image: null,
        streak: null,
        rank: null,
        rankLevel: 1,
        aura: 0,
        equippedGlow: null,
        equippedBadges: [],
        inventory: [],
        peakLevel: 0
    };

    const clanInfo = clanData || null;

    useEffect(() => {
        setLightbox({ open: false, index: 0 });
        setCurrentAssetIndex(0);
        setIsDownloading(false);
        setIsMediaSaved(false);

        try {
            const savedLikesStr = storage.getString('user_likes');
            const likedList = savedLikesStr ? JSON.parse(savedLikesStr) : [];
            setLiked(likedList.includes(post?._id));
        } catch (e) {
            console.error("MMKV Init Error", e);
        }
    }, [post?._id, storage]);

    const mediaItems = useMemo(() => {
        if (post.media && Array.isArray(post.media) && post.media.length > 0) return post.media;
        if (post.mediaUrl) return [{ url: post.mediaUrl, type: post.mediaType || "image" }];
        return [];
    }, [post.media, post.mediaUrl, post.mediaType]);

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

    // ⚡️ PERFORMANCE UPGRADE: Conditional SWR Fetching + Instant Hydration
    const { data: postData, mutate } = useSWR(
        (!syncing && post?._id && isVisible) ? `/posts/${post._id}` : null,
        fetcher,
        {
            refreshInterval: 120000,
            fallbackData: post, // Instantly populates cache with feed data
            revalidateOnMount: false
        }
    );

    // ⚡️ BULLETPROOF COUNTS: Safely checks both arrays and counts
    const totalLikes = postData?.likesCount ?? postData?.likes?.length ?? post?.likesCount ?? post?.likes?.length ?? 0;
    const totalComments = postData?.commentsCount ?? postData?.comments?.length ?? post?.commentsCount ?? post?.comments?.length ?? 0;
    const totalViews = postData?.viewsCount ?? postData?.views ?? post?.viewsCount ?? post?.views ?? 0;

    // ⚡️ NEW: Calculate Discussions
    const totalDiscussions = useMemo(() => {
        const commentsArray = postData?.comments || post?.comments || [];
        if (!Array.isArray(commentsArray)) return 0;

        let count = 0;
        commentsArray.forEach(c => {
            const replies = c.replies || [];

            // Condition 1: 3 or more replies
            if (replies.length >= 5) {
                count++;
                return;
            }

            // Condition 2: 2 or more DIFFERENT people active in the thread
            const authors = new Set();
            // Fallback strategy to find a unique identifier for the user
            const getId = (item) => item.authorUserId || item.authorFingerprint || item.name;

            authors.add(getId(c));
            replies.forEach(r => authors.add(getId(r)));

            if (authors.size >= 3) {
                count++;
            }
        });

        return count;
    }, [postData?.comments, post?.comments]);

    const userRank = useMemo(() => resolveUserRank(author.rankLevel), [author.rankLevel]);

    useEffect(() => {
        if (!post?._id || !user?.deviceId || syncing || !isVisible) return;
        const handleView = async () => {
            try {
                const viewedKey = "viewedPosts";
                const storedStr = storage.getString(viewedKey);
                const viewed = storedStr ? JSON.parse(storedStr) : [];
                if (viewed.includes(post._id)) return;

                const res = await apiFetch(`/posts/${post._id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ action: "view", fingerprint: user.deviceId }),
                });

                if (res.ok) {
                    const newViewed = [...viewed, post._id].slice(-200);
                    storage.set(viewedKey, JSON.stringify(newViewed));
                    if (typeof mutate === 'function') mutate();
                }
            } catch (err) { console.error("View track err:", err); }
        };
        handleView();
    }, [post?._id, user?.deviceId, syncing, isVisible, storage]);

    const handleLike = async () => {
        if (liked || !user) {
            if (!user) {
                CustomAlert("Hold on", "Please register to interact with posts.");
                DeviceEventEmitter.emit("navigateSafely", "screens/FirstLaunchScreen");
            }
            return;
        }

        const fingerprint = user?.deviceId;
        // ⚡️ SAFEKEEPER: Fallback if SWR hasn't fetched the object yet
        const previousData = postData || post;

        const currentLikes = postData?.likesCount ?? postData?.likes?.length ?? post?.likesCount ?? post?.likes?.length ?? 0;

        setLiked(true);
        mutate({
            ...(postData || post),
            likesCount: currentLikes + 1,
            likes: [...((postData || post)?.likes || []), { fingerprint }]
        }, false);

        try {
            const res = await apiFetch(`/posts/${post?._id}`, {
                method: "PATCH",
                body: JSON.stringify({ action: "like", fingerprint }),
            });

            if (res.status === 400 || res.ok) {
                const savedLikesStr = storage.getString('user_likes');
                const likedList = savedLikesStr ? JSON.parse(savedLikesStr) : [];

                if (!likedList.includes(post?._id)) {
                    likedList.push(post?._id);
                    storage.set('user_likes', JSON.stringify(likedList));
                }
            } else {
                throw new Error("Server rejected like request");
            }

        } catch (err) {
            console.error("Network Like Logic Failed", err);
            setLiked(false);
            mutate(previousData, false);
            CustomAlert("Sync Error", "Could not register your like. Please check your connection.");
        }
    };

    const handleNativeShare = async () => {
        try {
            const url = `https://oreblogda.com/post/${post?.slug || post?._id}`;
            const shareResult = await Share.share({ message: `Check out this post on Oreblogda: ${post?.title}\n${url}` });

            if (shareResult.action === Share.sharedAction) {
                const sharedStr = storage.getString('user_shares');
                const sharedList = sharedStr ? JSON.parse(sharedStr) : [];

                if (!sharedList.includes(post?._id)) {
                    const res = await apiFetch(`/posts/${post?._id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ action: "share", fingerprint: user?.deviceId })
                    });

                    if (res.ok) {
                        sharedList.push(post?._id);
                        storage.set('user_shares', JSON.stringify(sharedList));
                        mutate();
                    }
                }
            }
        } catch (error) {
            console.error("Share error", error);
        }
    };

    const handleDownloadMedia = async () => {
        const item = mediaItems[currentAssetIndex];
        if (!item || !item.url) return;
        try {
            setIsDownloading(true);
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                CustomAlert("Permission Denied", "We need gallery permissions to save media.");
                setIsDownloading(false);
                return;
            }
            const fileName = item.url.split('/').pop() || (item.type === "video" ? "video.mp4" : "image.jpg");
            const fileUri = FileSystem.cacheDirectory + fileName;
            const downloadRes = await FileSystem.downloadAsync(item.url, fileUri);
            await MediaLibrary.saveToLibraryAsync(downloadRes.uri);
            setIsMediaSaved(true);
            setTimeout(() => setIsMediaSaved(false), 3000);
            await FileSystem.deleteAsync(fileUri, { idempotent: true });
        } catch (error) {
            CustomAlert("System Failure", "Unable to download media at this time.");
        } finally { setIsDownloading(false); }
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
            else if (match[0] === 'br()' || match[0] === 'br') parts.push({ type: 'br' });
            lastIndex = regex.lastIndex;
        }
        if (lastIndex < text.length) parts.push({ type: 'text', content: text.slice(lastIndex) });
        return parts;
    };

    const activeGlowColor = author.equippedGlow?.visualConfig?.primaryColor || author.equippedGlow?.visualConfig?.glowColor || null;
    const customBadges = author.equippedBadges?.slice(0, 2) || [];
    const equippedWatermark = author.inventory?.find(i => i.category === 'WATERMARK' && i.isEquipped);

    const handleCopyFullText = async () => {
        let cleanText = post.message.replace(/br\(\)|\[br\]/g, '\n');
        cleanText = cleanText.replace(
            /s\((.*?)\)|\[section\](.*?)\[\/section\]|h\((.*?)\)|\[h\](.*?)\[\/h\]|l\((.*?)\)|\[li\](.*?)\[\/li\]|link\((.*?)\)-text\((.*?)\)|\[source="(.*?)" text:(.*?)\]/gs,
            (match, p1, p2, p3, p4, p5, p6, p8, p10) => p1 || p2 || p3 || p4 || p5 || p6 || p8 || p10 || ''
        ).trim();

        await Clipboard.setStringAsync(cleanText);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        CustomAlert("Scroll Copied", "The full text has been copied to your clipboard.");
    };

    const renderContent = useMemo(() => {
        const maxLength = 150;

        if (isFeed) {
            const plainText = post.message
                .replace(/s\((.*?)\)|\[section\](.*?)\[\/section\]|h\((.*?)\)|\[h\](.*?)\[\/h\]|l\((.*?)\)|\[li\](.*?)\[\/li\]|link\((.*?)\)-text\((.*?)\)|\[source="(.*?)" text:(.*?)\]|br\(\)|\[br\]/gs, (match, p1, p2, p3, p4, p5, p6, p8, p10) => p1 || p2 || p3 || p4 || p5 || p6 || p8 || p10 || '')
                .trim();
            const truncated = plainText.length > maxLength ? plainText.slice(0, maxLength) + "..." : plainText;
            return <Text style={{ color: isDark ? "#9ca3af" : "#4b5563" }} className="text-base leading-6">{truncated}</Text>;
        }

        const parts = parseCustomSyntax(post.message);

        const contentNodes = parts.map((part, i) => {
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

        return (
            <Pressable onLongPress={handleCopyFullText} delayLongPress={300}>
                {contentNodes}
            </Pressable>
        );

    }, [post.message, isFeed, isDark]);

    const renderMediaContent = () => {
        if (mediaItems.length === 0) return null;

        const glassStyle = { borderWidth: 1, borderColor: 'rgba(96, 165, 250, 0.2)', shadowColor: "#60a5fa", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 10 };
        const count = mediaItems.length;

        const openItem = (index) => {
            setCurrentAssetIndex(index);
            setLightbox({ open: true, index });
        };

        return (
            <View className="my-2 rounded-2xl overflow-hidden bg-black" style={[glassStyle, { height: 300 }]}>
                {count === 1 ? (
                    <View className="w-full h-full relative">
                        {mediaItems[0].type?.startsWith("video") || mediaItems[0].url.toLowerCase().includes("youtube") || mediaItems[0].url.toLowerCase().includes("tiktok") ? (
                            <MediaPlaceholder
                                height="100%"
                                type="video"
                                thumbUrl={getVideoThumbnail(mediaItems[0].url)}
                                onPress={() => openItem(0)}
                            />
                        ) : (
                            <Pressable onPress={() => openItem(0)} className="w-full h-full relative">
                                <Image source={{ uri: mediaItems[0].url }} style={{ width: '100%', height: '100%', flex: 1 }} contentFit="cover" />
                            </Pressable>
                        )}
                    </View>
                ) : count === 2 ? (
                    <View className="flex-row w-full h-full gap-[2px]">
                        {mediaItems.slice(0, 2).map((item, idx) => (
                            <Pressable key={idx} onPress={() => openItem(idx)} className="flex-1 relative">
                                <Image source={{ uri: item.type === "video" ? getVideoThumbnail(item.url) : item.url }} style={{ width: '100%', height: '100%', flex: 1 }} contentFit="cover" />
                                {item.type === "video" && (
                                    <View className="absolute inset-0 items-center justify-center bg-black/20">
                                        <Feather name="play" size={24} color="white" />
                                    </View>
                                )}
                            </Pressable>
                        ))}
                    </View>
                ) : (
                    <View className="flex-row w-full h-full gap-[2px]">
                        <Pressable onPress={() => openItem(0)} className="w-1/2 h-full relative">
                            <Image source={{ uri: mediaItems[0].type === "video" ? getVideoThumbnail(mediaItems[0].url) : mediaItems[0].url }} style={{ width: '100%', height: '100%', flex: 1 }} contentFit="cover" />
                            {mediaItems[0].type === "video" && <View className="absolute inset-0 items-center justify-center bg-black/20"><Feather name="play" size={30} color="white" /></View>}
                        </Pressable>
                        <View className="w-1/2 h-full gap-[2px]">
                            <Pressable onPress={() => openItem(1)} className="flex-1 relative">
                                <Image source={{ uri: mediaItems[1].type === "video" ? getVideoThumbnail(mediaItems[1].url) : mediaItems[1].url }} style={{ width: '100%', height: '100%', flex: 1 }} contentFit="cover" />
                                {mediaItems[1].type === "video" && <View className="absolute inset-0 items-center justify-center bg-black/20"><Feather name="play" size={20} color="white" /></View>}
                            </Pressable>
                            <Pressable onPress={() => openItem(2)} className="flex-1 relative">
                                <Image source={{ uri: mediaItems[2].type === "video" ? getVideoThumbnail(mediaItems[2].url) : mediaItems[2].url }} style={{ width: '100%', height: '100%', flex: 1 }} contentFit="cover" />
                                {count > 3 && (
                                    <View className="absolute inset-0 bg-black/60 items-center justify-center z-10">
                                        <Text className="text-white text-2xl font-black">+{count - 3}</Text>
                                    </View>
                                )}
                                {mediaItems[2].type === "video" && count <= 3 && <View className="absolute inset-0 items-center justify-center bg-black/20 z-10"><Feather name="play" size={20} color="white" /></View>}
                            </Pressable>
                        </View>
                    </View>
                )}
            </View>
        );
    };

    const aura = getAuraVisuals(author.rank);
    const isTop10 = author.rank > 0 && author.rank <= 10;
    const isClanPost = !!(post.clanId || post.clanTag);

    return (
        <View className={`mb-8 overflow-hidden rounded-[32px] border ${isDark ? "bg-[#0d1117] border-gray-800" : "bg-white border-gray-100 shadow-sm"} relative`}>

            <PlayerWatermark isFeed={true} equippedWatermark={equippedWatermark} isDark={isDark} />

            {isTop10 && (
                <View className="absolute inset-0 opacity-[0.04]" style={{ backgroundColor: activeGlowColor || aura.color }} pointerEvents="none" />
            )}

            <View className={`h-[3px] w-full bg-blue-600 opacity-20`} />

            <View className="p-4 px-2">
                <View className="mb-5">
                    {isClanPost && clanInfo && (
                        <MemoizedClanHeader clanInfo={clanInfo} isDark={isDark} postId={post._id} />
                    )}

                    <View className="flex-row justify-between items-start">
                        <View className="flex-row items-center gap-4 flex-1 pr-2">
                            <AuraAvatar author={author} glowColor={activeGlowColor} aura={aura} isTop10={isTop10} isDark={isDark} size={44} onPress={() => DeviceEventEmitter.emit("navigateSafely", `/author/${post.authorUserId}`)} />
                            <View className="flex-1">
                                <Pressable onPress={() => DeviceEventEmitter.emit("navigateSafely", `/author/${post.authorUserId}`)}>
                                    <View className="flex-row items-center gap-[2px]">
                                        <View className="flex-shrink">
                                            <PlayerNameplate
                                                author={author}
                                                themeColor={activeGlowColor || (isTop10 ? aura?.color : (isDark ? "#60a5fa" : "#2563eb"))}
                                                equippedGlow={author.equippedGlow}
                                                auraRank={author.rank || null}
                                                fontSize={13}
                                                isDark={isDark}
                                                showPeakBadge={false}
                                                showFlame={false}
                                            />
                                        </View>
                                        <Text className="text-gray-500 font-normal flex-shrink-0"> • </Text>
                                        <Ionicons name="flame" size={12} color={author.streak < 0 ? "#ef4444" : "#f97316"} />
                                        <Text className="text-gray-500 text-[10px] font-bold flex-shrink-0">{author.streak || "0"}</Text>
                                    </View>
                                    {isTop10 && (
                                        <View className="bg-white/10 px-1.5 py-0.5 rounded border flex-row items-center gap-1" style={{ borderColor: activeGlowColor || aura.color + '40', alignSelf: 'flex-start' }}>
                                            <MaterialCommunityIcons name={aura.icon} size={10} color={activeGlowColor || aura.color} />
                                            <Text style={{ color: activeGlowColor || aura.color, fontSize: 8, fontWeight: '900' }}>{aura.label}</Text>
                                        </View>
                                    )}
                                    <Text className="text-[10px] mt-2 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-tighter">{userRank.rankName || "Verified Author"}</Text>
                                </Pressable>
                            </View>
                        </View>

                        <View className="items-end">
                            <View className="shrink-0 flex-row items-center gap-2 bg-gray-50 dark:bg-gray-800/50 px-3 py-1.5 rounded-full border border-gray-100 dark:border-gray-700">
                                <View className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                                <Text className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest">{formatViews(totalViews)}</Text>
                            </View>

                            <View className="flex-row items-center gap-2 mt-2">
                                {customBadges.length > 0 && (
                                    <View className="flex-row items-center gap-1">
                                        {customBadges.map((badge, idx) => (
                                            <BadgeIcon key={idx} badge={badge} size={25} />
                                        ))}
                                    </View>
                                )}

                                {author.peakLevel > 0 ? (
                                    <View className="flex-row items-center gap-1 bg-purple-500/10 px-2 py-1 rounded-full border border-purple-500/30">
                                        <PeakBadge level={author.peakLevel} size={25} />
                                    </View>
                                ) : null}
                            </View>
                        </View>
                    </View>
                </View>

                <Pressable onPress={() => isFeed && DeviceEventEmitter.emit("navigateSafely", `/post/${post.slug || post?._id}`)} className="mb-4">
                    <Text selectable={true} className={`font-[900] uppercase italic tracking-tighter leading-tight mb-2 ${isDark ? "text-white" : "text-gray-900"} ${isFeed ? "text-2xl" : "text-3xl"}`}>
                        {post?.title}
                    </Text>
                    <View className="opacity-90">{renderContent}</View>
                </Pressable>

                <View className="mb-4 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800">
                    {renderMediaContent()}
                </View>

                {post.poll && (
                    <View className="mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800">
                        <Poll poll={post.poll} postId={post?._id} deviceId={user?.deviceId} />
                    </View>
                )}

                <View className="flex-row items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-4 mt-2">
                    <View className="flex-row items-center gap-6">
                        <Pressable onPress={handleLike} disabled={liked} className="flex-row items-center gap-2">
                            <Ionicons name={liked ? "heart" : "heart-outline"} size={20} color={liked ? "#ef4444" : isDark ? "#9ca3af" : "#4b5563"} />
                            <Text className={`text-xs font-black ${liked ? "text-red-500" : "text-gray-500"}`}>{formatViews(totalLikes)}</Text>
                        </Pressable>
                        <Pressable onPress={() => DeviceEventEmitter.emit("navigateSafely", `/post/${post.slug || post?._id}?comment=open`)} className="flex-row items-center gap-2">
                            <MaterialCommunityIcons name="comment-text-outline" size={18} color={isDark ? "#9ca3af" : "#4b5563"} />
                            <Text className="text-xs font-black text-gray-500">{formatViews(totalComments)}</Text>
                        </Pressable>
                        {/* ⚡️ NEW: Discussion Icon and Count */}
                        <Pressable onPress={() => DeviceEventEmitter.emit("navigateSafely", `/post/${post.slug || post?._id}?comment=open`)} className="flex-row items-center gap-2">
                            <MaterialCommunityIcons name="forum-outline" size={18} color={isDark ? "#9ca3af" : "#4b5563"} />
                            <Text className="text-xs font-black text-gray-500">{formatViews(totalDiscussions)}</Text>
                        </Pressable>
                    </View>
                    <Pressable onPress={handleNativeShare} className="w-10 h-10 items-center justify-center bg-gray-50 dark:bg-gray-800/80 rounded-full border border-gray-200 dark:border-gray-700">
                        <Feather name="share-2" size={16} color={isDark ? "#60a5fa" : "#2563eb"} />
                    </Pressable>
                </View>
            </View>

            {lightbox.open && (
                <MediaModal
                    isOpen={lightbox.open}
                    onClose={closeLightbox}
                    mediaItems={mediaItems}
                    currentIndex={currentAssetIndex}
                    setCurrentIndex={setCurrentAssetIndex}
                    handleDownload={handleDownloadMedia}
                    isDownloading={isDownloading}
                    isMediaSaved={isMediaSaved}
                />
            )}
        </View>
    );
};

export default memo(PostCardComponent, (prevProps, nextProps) => {
    // ⚡️ PERFORMANCE OPTIMIZATION: Only re-render if it becomes visible or syncing state changes
    return prevProps.post._id === nextProps.post._id &&
        prevProps.isVisible === nextProps.isVisible &&
        prevProps.syncing === nextProps.syncing;
});