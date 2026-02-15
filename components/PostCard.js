import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from 'expo-file-system/legacy'; // Legacy import for SDK 54+
import * as MediaLibrary from 'expo-media-library';
import { useNavigation, usePathname, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Animated,
	BackHandler,
	DeviceEventEmitter,
	Dimensions,
	Easing,
	Image,
	Linking,
	Modal,
	Pressable,
	Share,
	useColorScheme,
	View
} from "react-native";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ImageZoom from 'react-native-image-pan-zoom';
import { WebView } from "react-native-webview";
import YoutubePlayer from "react-native-youtube-iframe";
import useSWR from "swr";

// Components & Context
import { useUser } from "../context/UserContext";
import apiFetch from "../utils/apiFetch";
import ClanCrest from "./ClanCrest";
import Poll from "./Poll";
import { SyncLoading } from "./SyncLoading";
import { Text } from "./Text";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const fetcher = (url) => apiFetch(url).then((res) => res.json());

// 🔹 CLAN RANK UTILITY
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

// 🔹 AURA UI UTILITY
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
// --- PLACE THESE OUTSIDE THE COMPONENT FUNCTION ---
const AUTHOR_CACHE = {};
const CLAN_CACHE = {};
// Helper to save to Tier 2: AsyncStorage
const persistToStorage = async (key, data) => {
    try {
        await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error("Storage Error", e);
    }
};


export default function PostCard({ post, setPosts, isFeed, hideMedia, similarPosts }) {
	const { user } = useUser();
	const router = useRouter();
	const pathname = usePathname();
	const navigation = useNavigation();
	const colorScheme = useColorScheme();
	const isDark = colorScheme === "dark";

	const [lightbox, setLightbox] = useState({ open: false, index: 0 });
	const [currentAssetIndex, setCurrentAssetIndex] = useState(0);
	const [assetLoading, setAssetLoading] = useState(true);
	const [isDownloading, setIsDownloading] = useState(false);
	const [liked, setLiked] = useState(false);
	const [isMediaSaved, setIsMediaSaved] = useState(false)
	// Initialize state from cache if available to prevent layout shift
	const [author, setAuthor] = useState(AUTHOR_CACHE[post.authorUserId] || {
		name: post.authorName,
		image: null,
		streak: null,
		rank: null
	});
	const [clanInfo, setClanInfo] = useState(CLAN_CACHE[post.clanId || post.clanTag] || null)
	const [loadingClan, setLoadingClan] = useState(false);

	const [loadMedia, setLoadMedia] = useState(false);
	const [videoReady, setVideoReady] = useState(false);
	const [tikTokReady, setTikTokReady] = useState(false);
	const [isVideoLoading, setIsVideoLoading] = useState(true);

	const mediaItems = useMemo(() => {
		if (post.media && Array.isArray(post.media) && post.media.length > 0) {
			return post.media;
		}
		if (post.mediaUrl) {
			return [{ url: post.mediaUrl, type: post.mediaType || "image" }];
		}
		return [];
	}, [post.media, post.mediaUrl, post.mediaType]);

	// 🔹 FEED VIDEO PLAYER
	const directVideoUrl = useMemo(() => {
		const firstItem = mediaItems[0];
		if (firstItem && (firstItem.type?.startsWith("video") || firstItem.url.toLowerCase().match(/\.(mp4|mov|m4v|webm)$/i))) {
			return firstItem.url;
		}
		return null;
	}, [mediaItems]);

	const player = useVideoPlayer(directVideoUrl, (p) => {
		p.loop = false;
		p.pause();
	});

	// 🔹 LIGHTBOX VIDEO PLAYER
	const lightboxVideoUrl = useMemo(() => {
		const item = mediaItems[currentAssetIndex];
		if (item && item.type === "video") return item.url;
		return null;
	}, [mediaItems, currentAssetIndex]);

	const lightboxPlayer = useVideoPlayer(lightboxVideoUrl, (p) => {
		p.loop = false;
		if (lightbox.open) p.play();
	});

	// 🔹 AUTO-PAUSE LOGIC
	useEffect(() => {
		const unsubscribe = navigation.addListener('blur', () => {
			player.pause();
			lightboxPlayer.pause();
		});
		return unsubscribe;
	}, [navigation, player, lightboxPlayer]);

	useEffect(() => {
		player.pause();
		lightboxPlayer.pause();
	}, [pathname]);

	useEffect(() => {
		if (lightbox.open) {
			player.pause();
		}
	}, [lightbox.open]);

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
		lightboxPlayer.pause();
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
        const fetchData = async () => {
            const authorId = post.authorUserId;
            const clanTag = post.clanId || post.clanTag;

            // --- STEP A: Check AsyncStorage if Memory is empty ---
            if (!AUTHOR_CACHE[authorId]) {
                const storedAuthor = await AsyncStorage.getItem(`auth_cache_${authorId}`);
                if (storedAuthor) {
                    const parsed = JSON.parse(storedAuthor);
                    AUTHOR_CACHE[authorId] = parsed;
                    setAuthor(parsed);
                }
            }

            if (clanTag && !CLAN_CACHE[clanTag]) {
                const storedClan = await AsyncStorage.getItem(`clan_cache_${clanTag}`);
                if (storedClan) {
                    const parsed = JSON.parse(storedClan);
                    CLAN_CACHE[clanTag] = parsed;
                    setClanInfo(parsed);
                }
            }

            // --- STEP B: Background Fetch (Revalidation) ---
            try {
                // Fetch Author
                const resAuthor = await apiFetch(`/users/${authorId}`);
                if (resAuthor.ok) {
                    const data = await resAuthor.json();
                    const authorData = {
                        name: data.user?.username || post.authorName,
                        image: data.user?.profilePic?.url,
                        streak: data.user?.lastStreak || null,
                        rank: data.user?.previousRank || 0
                    };
                    // Update Memory & State
                    AUTHOR_CACHE[authorId] = authorData;
                    setAuthor(authorData);
                    // Update Storage (Tier 2)
                    persistToStorage(`auth_cache_${authorId}`, authorData);
                }
            } catch (err) {
                console.error("Revalidation err", err);
            }
        };

        fetchData();
    }, [post.authorUserId, post.clanId, post.clanTag, user?.deviceId]);

	useEffect(() => {
		if (!post?._id || !user?.deviceId) return;
		const handleView = async () => {
			try {
				const viewedKey = "viewedPosts";
				const stored = await AsyncStorage.getItem(viewedKey);
				const viewed = stored ? JSON.parse(stored) : [];
				if (viewed.includes(post._id)) return;
				const res = await apiFetch(`/posts/${post._id}`, {
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
			apiFetch(`/posts/${post?._id}`, {
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
			apiFetch(`/posts/${post?._id}`, { method: "PATCH", body: JSON.stringify({ action: "share", fingerprint: user.deviceId }) });
			mutate();
		} catch (error) { console.error("Share error", error); }
	};
	const handleDownloadMedia = async () => {
		const item = mediaItems[currentAssetIndex];
		if (!item || !item.url) return;

		try {
			setIsDownloading(true);

			// 1. Request Permissions
			// On Android 13+, this requests READ_MEDIA_IMAGES/VIDEO
			// On older versions, it requests WRITE_EXTERNAL_STORAGE
			const { status } = await MediaLibrary.requestPermissionsAsync();

			if (status !== 'granted') {
				Alert.alert("Permission Denied", "We need gallery permissions to save media.");
				setIsDownloading(false);
				return;
			}

			const fileName = item.url.split('/').pop() || (item.type === "video" ? "video.mp4" : "image.jpg");
			const fileUri = FileSystem.cacheDirectory + fileName;

			// 2. Download the file to the app's cache first
			const downloadRes = await FileSystem.downloadAsync(item.url, fileUri);

			// 3. Save directly to the System Library
			// This avoids the 'addAssetsToAlbumAsync' permission error entirely
			await MediaLibrary.saveToLibraryAsync(downloadRes.uri);
			setIsMediaSaved(true)
			setTimeout(() => {
				setIsMediaSaved(false)
			}, 3000);

			// Optional: Clean up the cache file after saving
			await FileSystem.deleteAsync(fileUri, { idempotent: true });

		} catch (error) {
			console.error("Download error:", error);
			Alert.alert("System Failure", "Unable to download media at this time.");
		} finally {
			setIsDownloading(false);
		}
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
		const maxLength = similarPosts ? 100 : 150;
		if (isFeed) {
			const plainText = post.message
				.replace(/s\((.*?)\)|\[section\](.*?)\[\/section\]|h\((.*?)\)|\[h\](.*?)\[\/h\]|l\((.*?)\)|\[li\](.*?)\[\/li\]|link\((.*?)\)-text\((.*?)\)|\[source="(.*?)" text:(.*?)\]|br\(\)|\[br\]/gs, (match, p1, p2, p3, p4, p5, p6, p8, p10) => p1 || p2 || p3 || p4 || p5 || p6 || p8 || p10 || '')
				.trim();
			const truncated = plainText.length > maxLength ? plainText.slice(0, maxLength) + "..." : plainText;
			return <Text style={{ color: isDark ? "#9ca3af" : "#4b5563" }} className={`${similarPosts ? "text-sm" : "text-base"} leading-6`}>{truncated}</Text>;
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
		if (mediaItems.length === 0) return null;

		const firstItem = mediaItems[0];
		const lowerUrl = firstItem.url.toLowerCase();
		const isYouTube = lowerUrl.includes("youtube.com") || lowerUrl.includes("youtu.be");
		const isTikTok = lowerUrl.includes("tiktok.com");
		const isDirectVideo = firstItem.type?.startsWith("video") || lowerUrl.match(/\.(mp4|mov|m4v|webm)$/i);
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
			return <View className="w-full rounded-2xl overflow-hidden my-2 bg-black" style={glassStyle}>{!videoReady && <MediaSkeleton height={similarPosts ? 160 : 210} />}<YoutubePlayer height={similarPosts ? 160 : videoReady ? 210 : 0} play={false} videoId={getYouTubeID(firstItem.url)} onReady={() => setVideoReady(true)} webViewProps={{ allowsInlineMediaPlayback: true, androidLayerType: "hardware" }} /></View>;
		}

		if (isTikTok) {
			const getTikTokEmbedUrl = (url) => {
				const match = url.match(/\/video\/(\d+)/);
				return match?.[1] ? `https://www.tiktok.com/embed/${match[1]}` : url;
			}
			return <View className="w-full rounded-2xl overflow-hidden my-2 bg-black" style={[{ height: similarPosts ? 200 : 600 }, glassStyle]}>{!tikTokReady && <MediaSkeleton height={similarPosts ? 200 : 600} />}<WebView source={{ uri: getTikTokEmbedUrl(firstItem.url) }} userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)" onLoadEnd={() => setTikTokReady(true)} scrollEnabled={false} allowsFullscreenVideo javaScriptEnabled domStorageEnabled allowsInlineMediaPlayback={true} style={{ flex: 1, opacity: tikTokReady ? 1 : 0 }} /></View>;
		}

		const count = mediaItems.length;
		const openItem = (index) => {
			setCurrentAssetIndex(index);
			setLightbox({ open: true, index });
		};

		return (
			<View className="my-2 rounded-2xl overflow-hidden bg-black" style={[glassStyle, { height: similarPosts ? 200 : 300 }]}>
				{count === 1 ? (
					// Logic: If it's a video and there's only 1 item, don't wrap in Lightbox Pressable so user can interact with the video player
					isDirectVideo ? (
						<View className="w-full h-full items-center justify-center">
							<VideoView
								player={player}
								style={{ width: "100%", height: "100%" }}
								contentFit="contain"
								nativeControls={true}
								onIsVideoReadyToPlay={() => setIsVideoLoading(false)}
							/>
						</View>
					) : (
						<Pressable onPress={() => openItem(0)} className="w-full h-full">
							<Image source={{ uri: firstItem.url }} className="w-full h-full" resizeMode="cover" />
						</Pressable>
					)
				) : count === 2 ? (
					<View className="flex-row w-full h-full gap-[2px]">
						{mediaItems.slice(0, 2).map((item, idx) => (
							<Pressable key={idx} onPress={() => openItem(idx)} className="flex-1">
								{item.type === "video" ? (
									<VideoView
										player={player}
										style={{ width: "100%", height: "100%" }}
										contentFit="cover"
										nativeControls={false}
									/>
								) : (
									<Image source={{ uri: item.url }} className="w-full h-full" resizeMode="cover" />
								)}
							</Pressable>
						))}
					</View>
				) : (
					<View className="flex-row w-full h-full gap-[2px]">
						<Pressable onPress={() => openItem(0)} className="w-1/2 h-full">
							<Image source={{ uri: mediaItems[0].url }} className="w-full h-full" resizeMode="cover" />
						</Pressable>
						<View className="w-1/2 h-full gap-[2px]">
							<Pressable onPress={() => openItem(1)} className="flex-1">
								<Image source={{ uri: mediaItems[1].url }} className="w-full h-full" resizeMode="cover" />
							</Pressable>
							<Pressable onPress={() => openItem(2)} className="flex-1 relative">
								<Image source={{ uri: mediaItems[2].url }} className="w-full h-full" resizeMode="cover" />
								{count > 3 && (
									<View className="absolute inset-0 bg-black/60 items-center justify-center">
										<Text className="text-white text-2xl font-black">+{count - 2}</Text>
									</View>
								)}
							</Pressable>
						</View>
					</View>
				)}
			</View>
		);
	};

	const aura = getAuraVisuals(author.rank);
	const isTop3 = author.rank > 0 && author.rank <= 3;
	const isTop10 = author.rank > 0 && author.rank <= 10;
	const isClanPost = !!(post.clanId || post.clanTag);

	const getRankedFrameStyle = () => {
		if (author.rank === 1) return { borderRadius: 14, transform: [{ rotate: '45deg' }], borderWidth: 2 };
		if (author.rank === 2) return { borderRadius: 25, borderWidth: 2 };
		if (author.rank === 3) return { borderRadius: 8, borderWidth: 1.5 };
		return { borderRadius: 100, borderWidth: 1 };
	};

	const goToNext = () => {
		if (currentAssetIndex < mediaItems.length - 1) {
			setCurrentAssetIndex(prev => prev + 1);
		}
	};

	const goToPrev = () => {
		if (currentAssetIndex > 0) {
			setCurrentAssetIndex(prev => prev - 1);
		}
	};

	return (
		<View className={`${similarPosts ? "mb-4" : "mb-8"} overflow-hidden rounded-[32px] border ${isDark ? "bg-[#0d1117] border-gray-800" : "bg-white border-gray-100 shadow-sm"}`}>

			{isTop10 && (
				<View className="absolute inset-0 opacity-[0.04]" style={{ backgroundColor: aura.color }} pointerEvents="none" />
			)}

			{(isClanPost || isTop3) && (
				<View className="absolute inset-0 opacity-[0.04]" style={{ backgroundColor: isClanPost ? '#60a5fa' : aura.color }} />
			)}

			<View className={`h-[3px] w-full bg-blue-600 opacity-20`} />
			<View className={`${similarPosts ? "p-3" : "p-4"} px-2`}>
				<View className="mb-5">
					{/* 🛡️ FULL-WIDTH CLAN BANNER */}
					{isClanPost && clanInfo && (
						<View className="flex-row items-center justify-between bg-blue-50/50 dark:bg-blue-900/10 px-2 py-3 rounded-2xl border border-blue-100/50 dark:border-blue-800/20 mb-4">
							<Pressable
								onPress={() => DeviceEventEmitter.emit("navigateSafely", `/clans/${clanInfo.tag || post.clanId}`)}
								className="flex-row items-center flex-1"
							>
								{/* Integrated your ClanCrest here */}
								<View className="mr-3">
									<ClanCrest isFeed={true} rank={clanInfo.rank} size={40} />
								</View>

								<View className="ml-1">
									<View className="flex-row items-center">
										<Text className="text-[14px] font-[900] text-blue-600 dark:text-blue-400 uppercase tracking-tight">
											{clanInfo.name}
										</Text>
										<MaterialCommunityIcons
											name="check-decagram"
											size={14}
											color="#3b82f6"
											style={{ marginLeft: 4 }}
										/>
									</View>
									<Text className="text-[10px] text-blue-500/70 dark:text-blue-400/60 font-black uppercase italic tracking-widest">
										{getClanRankTitle(clanInfo.rank)}
									</Text>
								</View>
							</Pressable>

							{/* ⚔️ WAR STATUS INDICATOR */}
							<View className="flex-row items-center">
								{clanInfo.isInWar && (
									<View className="mr-1 items-center justify-center">
										<View className="bg-red-500/10 dark:bg-red-500/20 p-1.5 rounded-full border border-red-500/30">
											<MaterialCommunityIcons name="sword-cross" size={16} color="#ef4444" />
										</View>
										<Text className="text-[7px] text-red-500 font-black uppercase absolute -bottom-3">WAR</Text>
									</View>
								)}
							</View>
						</View>
					)}

					{/* --- AUTHOR & STATS ROW --- */}
					<View className="flex-row justify-between items-start">
						<View className="flex-row items-center gap-4 flex-1 pr-2">
							{/* AUTHOR AVATAR SECTION */}
							<Pressable
								onPress={() => DeviceEventEmitter.emit("navigateSafely", `/author/${post.authorUserId}`)}
								className="relative shrink-0 w-14 h-14 items-center justify-center"
							>
								{isTop10 && author.rank <= 5 && (
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

								<View style={{ backgroundColor: isTop10 ? aura.color : '#2563eb' }} className="absolute bottom-1 right-1 w-3.5 h-3.5 border-2 border-white dark:border-[#0d1117] rounded-full shadow-sm" />
							</Pressable>

							{/* AUTHOR INFO SECTION */}
							<View className="flex-1">
								<Pressable onPress={() => DeviceEventEmitter.emit("navigateSafely", `/author/${post.authorUserId}`)}>
									<View className="flex-row items-center gap-1 flex-wrap">
										<Text style={{ color: isTop10 ? aura.color : (isDark ? "#60a5fa" : "#2563eb") }} className="font-[900] uppercase tracking-widest text-[12px]">
											{author.name || "Unknown Entity"}
										</Text>

										<Text className="text-gray-500 font-normal"> • </Text>
										<Ionicons name="flame" size={12} color={author.streak < 0 ? "#ef4444" : "#f97316"} />
										<Text className="text-gray-500 text-[10px] font-bold">{author.streak || "0"}</Text>
									</View>

									{isTop10 && (
										<View className="bg-white/10 px-1.5 py-0.5 rounded border flex-row items-center gap-1 mt-1" style={{ borderColor: aura.color + '40', alignSelf: 'flex-start' }}>
											<MaterialCommunityIcons name={aura.icon} size={8} color={aura.color} />
											<Text style={{ color: aura.color, fontSize: 7, fontWeight: '900' }}>{aura.label}</Text>
										</View>
									)}

									<Text className="text-[10px] mt-0.5 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-tighter">
										{userRank.rankName || "Verified Author"}
									</Text>
								</Pressable>
							</View>
						</View>

						{/* --- RIGHT SIDE STATS --- */}
						<View className="items-end">
							<View className="shrink-0 flex-row items-center gap-2 bg-gray-50 dark:bg-gray-800/50 px-3 py-1.5 rounded-full border border-gray-100 dark:border-gray-700">
								<View className="w-1.5 h-1.5 bg-green-500 rounded-full" />
								<Text className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest">
									{formatViews(totalViews)}
								</Text>
							</View>
						</View>
					</View>
				</View>

				<Pressable onPress={() => isFeed && DeviceEventEmitter.emit("navigateSafely", `/post/${post.slug || post?._id}`)} className="mb-4">
					<Text className={`font-[900] uppercase italic tracking-tighter leading-tight mb-2 ${isDark ? "text-white" : "text-gray-900"} ${similarPosts ? "text-xl" : isFeed ? "text-2xl" : "text-3xl"}`}>
						{post?.title}
					</Text>
					<View className="opacity-90">{renderContent}</View>
					{/* {!isFeed && !similarPosts && (
						<View className="mb-3 mt-3 w-full p-6 border border-dashed border-gray-300 dark:border-gray-800 rounded-[32px] bg-gray-50/50 dark:bg-white/5 items-center justify-center">
							<Text className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] italic text-center">Sponsored Transmission</Text>
							<AppBanner size="BANNER" />
						</View>
					)} */}
				</Pressable>

				<View className={`${similarPosts ? "mb-2" : "mb-4"} rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800`}>
					{renderMediaContent()}
				</View>

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

				{similarPosts ? (
					<View className="flex-row items-center justify-between mt-2 pt-2 border-t border-gray-50 dark:border-gray-800">
						<View className="flex-row items-center gap-4">
							<View className="flex-row items-center gap-1">
								<Ionicons name="heart" size={14} color="#ef4444" />
								<Text className="text-[10px] font-bold text-gray-500">{totalLikes}</Text>
							</View>
							<View className="flex-row items-center gap-1">
								<MaterialCommunityIcons name="comment" size={12} color="#9ca3af" />
								<Text className="text-[10px] font-bold text-gray-500">{totalComments}</Text>
							</View>
						</View>
						<Pressable onPress={() => DeviceEventEmitter.emit("navigateSafely", `/post/${post.slug || post?._id}`)}>
							<Text className="text-[10px] font-black text-blue-500 uppercase">View Post</Text>
						</Pressable>
					</View>
				) : (
					<View className="flex-row items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-4 mt-2">
						<View className="flex-row items-center gap-6">
							<Pressable onPress={handleLike} disabled={liked} className="flex-row items-center gap-2">
								<Ionicons name={liked ? "heart" : "heart-outline"} size={20} color={liked ? "#ef4444" : isDark ? "#9ca3af" : "#4b5563"} />
								<Text className={`text-xs font-black ${liked ? "text-red-500" : "text-gray-500"}`}>{totalLikes}</Text>
							</Pressable>
							<Pressable onPress={() => DeviceEventEmitter.emit("navigateSafely", `/post/${post.slug || post?._id}`)} className="flex-row items-center gap-2">
								<MaterialCommunityIcons name="comment-text-outline" size={18} color={isDark ? "#9ca3af" : "#4b5563"} />
								<Text className="text-xs font-black text-gray-500">{totalComments}</Text>
							</Pressable>
						</View>
						<Pressable onPress={handleNativeShare} className="w-10 h-10 items-center justify-center bg-gray-50 dark:bg-gray-800/80 rounded-full border border-gray-200 dark:border-gray-700">
							<Feather name="share-2" size={16} color={isDark ? "#60a5fa" : "#2563eb"} />
						</Pressable>
					</View>
				)}
			</View>

			<Modal visible={lightbox.open} transparent animationType="fade" onRequestClose={closeLightbox}>
				<GestureHandlerRootView style={{ flex: 1, backgroundColor: 'black' }}>

					<View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}>
						{mediaItems[currentAssetIndex]?.type === "video" ? (
							<View className="flex-1 justify-center">
								<VideoView
									player={lightboxPlayer}
									style={{ width: "100%", height: "80%" }}
									contentFit="contain"
									nativeControls={true}
									showsTimecodes={true}
								/>
							</View>
						) : (
							<View className="flex-1">
								<ImageZoom
									cropWidth={SCREEN_WIDTH}
									cropHeight={SCREEN_HEIGHT}
									imageWidth={SCREEN_WIDTH}
									imageHeight={SCREEN_HEIGHT}
									panToMove={true}
									pinchToZoom={true}
									enableSwipeDown={true}
									onSwipeDown={closeLightbox}
								>
									<Image
										style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
										source={{ uri: mediaItems[currentAssetIndex]?.url }}
										resizeMode="contain"
										onLoadStart={() => setAssetLoading(true)}
										onLoadEnd={() => setAssetLoading(false)}
									/>
								</ImageZoom>
								{assetLoading && (
									<View className="absolute inset-0 items-center justify-center bg-black/20">
										<SyncLoading message="Synchronizing Visuals" />
									</View>
								)}
							</View>
						)}
					</View>

					{mediaItems.length > 1 && (
						<>
							{currentAssetIndex > 0 && (
								<Pressable
									onPress={goToPrev}
									className="absolute left-4 top-1/2 -translate-y-1/2 p-4 bg-black/50 rounded-full z-50 border border-white/10"
								>
									<Feather name="chevron-left" size={28} color="white" />
								</Pressable>
							)}

							{currentAssetIndex < mediaItems.length - 1 && (
								<Pressable
									onPress={goToNext}
									className="absolute right-4 top-1/2 -translate-y-1/2 p-4 bg-black/50 rounded-full z-50 border border-white/10"
								>
									<Feather name="chevron-right" size={28} color="white" />
								</Pressable>
							)}
						</>
					)}

					<Pressable onPress={closeLightbox} className="absolute top-14 right-6 p-3 bg-black/40 rounded-full z-50">
						<Feather name="x" size={24} color="white" />
					</Pressable>

					{mediaItems[currentAssetIndex]?.type !== "youtube" && (
						<Pressable
							onPress={handleDownloadMedia}
							disabled={isDownloading || isMediaSaved}
							className="absolute top-14 left-6 p-3 bg-black/40 rounded-full z-50 flex-row items-center gap-2"
						>
							{isDownloading ? (
								<ActivityIndicator size="small" color="#60a5fa" />
							) : (
								<Feather name={isMediaSaved ? "check" : "download"} size={24} color="white" />
							)}
						</Pressable>
					)}

					{mediaItems.length > 1 && (
						<View className="absolute bottom-12 w-full items-center">
							<View className="bg-black/60 px-6 py-2 rounded-full border border-white/10">
								<Text className="text-white font-black tracking-widest uppercase text-xs">
									Asset {currentAssetIndex + 1} / {mediaItems.length}
								</Text>
							</View>
						</View>
					)}
				</GestureHandlerRootView>
			</Modal>
		</View>
	);
}