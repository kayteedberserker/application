import { Feather, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Video } from "expo-av";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    Modal,
    Pressable,
    Share,
    useColorScheme,
    View
} from "react-native";
import { WebView } from "react-native-webview";
import useSWR from "swr";

// Components & Context
import { useUser } from "../context/UserContext";
import Poll from "./Poll";
import { Text } from "./Text";

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function PostCard({ post, setPosts, isFeed, hideMedia }) {
    const router = useRouter();
    const { user } = useUser();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";

    // Lightbox state
    const [lightbox, setLightbox] = useState({ open: false, src: null, type: null });
    const [liked, setLiked] = useState(false);
    const [author, setAuthor] = useState({ name: post.authorName, image: null });

    // SWR for live post stats
    const { data: postData, mutate } = useSWR(
        post?._id ? `https://oreblogda.com/api/posts/${post._id}` : null,
        fetcher,
        { refreshInterval: 10000 } // optional auto-refresh every 10s
    );

    const totalLikes = postData?.likes?.length || 0;
    const totalComments = postData?.comments?.length || 0;
    const totalShares = postData?.shares || 0;
    const totalViews = postData?.views || 0;

    // Fetch Author
    useEffect(() => {
        const fetchAuthor = async () => {
            try {
                const res = await fetch(`https://oreblogda.com/api/users/${post.authorId || post.authorUserId}`);
                if (res.ok) {
                    const data = await res.json();
                    setAuthor({
                        name: data.name || post.authorName,
                        image: data.user?.profilePic?.url
                    });
                }
            } catch (err) {
            }
        };
        if (post.authorId || post.authorUserId) fetchAuthor();
    }, [post.authorId, post.authorUserId, post.authorName]);

    // View Tracking (Once per device)
    useEffect(() => {
        // 1. Ensure we have what we need
        if (!post?._id || !user?.deviceId) return;

        const handleView = async () => {
            try {
                const viewedKey = "viewedPosts";
                const stored = await AsyncStorage.getItem(viewedKey);
                const viewed = stored ? JSON.parse(stored) : [];
                
                // 2. Check if already viewed
                if (viewed.includes(post._id)) return;
                // 3. Update the Server (Using your Vercel URL)
                const res = await fetch(`https://oreblogda.com/api/posts/${post._id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "view",
                        fingerprint: user.deviceId
                    }),
                });
                
                if (res.ok) {
                    // 4. Update Local Storage (Keep only the last 200 to save memory)
                    const newViewed = [...viewed, post._id].slice(-200);
                    await AsyncStorage.setItem(viewedKey, JSON.stringify(newViewed));

                    // 5. Mutate only if the function exists
                    if (typeof mutate === 'function') {
                        
                        mutate();
                    }
                }
            } catch (err) {
                console.error("View track err:", err);
            }
        };

        handleView();
    }, [post?._id, user?.deviceId]);

    const refreshPosts = (updatedPost) => {
        if (setPosts) {
            setPosts((prev) =>
                Array.isArray(prev)
                    ? prev.map((p) => (p._id === updatedPost._id ? updatedPost : p))
                    : updatedPost
            );
        }
    };

    // Initial Sync: Check AsyncStorage for likes
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

    // Handle Like
    const handleLike = async () => {
        if (liked || !user) {
            if (!user) Alert.alert("Hold on", "Please register to interact with posts.");
            router.replace("screens/FirstLaunchScreen");
            return;
        }

        try {
            // Optimistic UI update
            setLiked(true);
            mutate(
                { ...postData, likes: [...(postData?.likes || []), { fingerprint: user.deviceId }] },
                false
            );

            // Save to AsyncStorage
            const savedLikes = await AsyncStorage.getItem('user_likes');
            const likedList = savedLikes ? JSON.parse(savedLikes) : [];
            if (!likedList.includes(post?._id)) {
                likedList.push(post?._id);
                await AsyncStorage.setItem('user_likes', JSON.stringify(likedList));
            }

            // Sync with backend
            const res = await fetch(`https://oreblogda.com/api/posts/${post?._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "like", fingerprint: user.deviceId }),
            });
            const data = await res.json();
            mutate(data); // Refresh SWR data
            refreshPosts(data);
        } catch (err) {
            console.error("Like sync failed", err);
        }
    };

    // Handle Share
    const handleNativeShare = async () => {
        try {
            const url = `https://oreblogda.com/post/${post?.slug || post?._id}`;
            await Share.share({
                message: `Check out this post on Oreblogda: ${post?.title}\n${url}`,
                url,
            });

            // Track share
            await fetch(`https://oreblogda.com/api/posts/${post?._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "share", fingerprint: user.deviceId }),
            });
            mutate(); // Refresh SWR data
        } catch (error) {
        }
    };

    // --- Message Rendering Logic ---

    const parseMessageSections = (msg) => {
        const regex = /\[section\](.*?)\[\/section\]|\[h\](.*?)\[\/h\]|\[li\](.*?)\[\/li\]|\[source="(.*?)" text:(.*?)\]|\[br\]/gs;
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(msg)) !== null) {
            if (match.index > lastIndex) {
                parts.push({ type: "text", content: msg.slice(lastIndex, match.index) });
            }
            if (match[1] !== undefined) parts.push({ type: "section", content: match[1].trim() });
            else if (match[2] !== undefined) parts.push({ type: "heading", content: match[2].trim() });
            else if (match[3] !== undefined) parts.push({ type: "listItem", content: match[3].trim() });
            else if (match[4] !== undefined) parts.push({ type: "link", url: match[4], content: match[5] });
            else parts.push({ type: "br" });
            lastIndex = regex.lastIndex;
        }
        if (lastIndex < msg.length) parts.push({ type: "text", content: msg.slice(lastIndex) });
        return parts;
    };

    const renderContent = () => {
        const maxLength = 150;
        const WORD_THRESHOLD = 90; // Inject ad every 200 words
        let totalWordCount = 0;
        let nextAdThreshold = WORD_THRESHOLD;

        if (isFeed) {
            const plainText = post.message.replace(/\[section\](.*?)\[\/section\]|\[h\](.*?)\[\/h\]|\[li\](.*?)\[\/li\]|\[source=".*?" text:.*?\]|\[br\]/gs, "");
            const truncated = plainText.length > maxLength ? plainText.slice(0, maxLength) + "..." : plainText;
            return <Text style={{ whiteSpace: 'pre-wrap' }}>{truncated}</Text>;
        }

        const mobileStyle = { includeFontPadding: false, textAlignVertical: 'center' };

        const handlePress = async (url) => {
            const supported = await Linking.canOpenURL(url);
            if (supported) await Linking.openURL(url);
            else Alert.alert("Invalid Link", "Cannot open this URL");
        };

        const rawParts = parseMessageSections(post.message);
        const finalElements = [];
        let inlineBuffer = [];

        // Helper to inject the Ad component
        // const renderInArticleAd = (key) => (
        //     <View key={`ad-${key}`} className="my-6 items-center py-4 border-y border-gray-100 dark:border-gray-800">
        //         <Text className="text-[10px] text-gray-400 mb-2 uppercase">Advertisement</Text>
        //         <BannerAd
        //             unitId={TestIds.BANNER}
        //             size={BannerAdSize.BANNER}
        //             onAdFailedToLoad={(error) => console.error(error)}
        //         />
        //     </View>
        // );

        const flushInlineBuffer = (key) => {
            if (inlineBuffer.length > 0) {
                finalElements.push(
                    <Text
                        key={`inline-${key}`}
                        style={[mobileStyle, { whiteSpace: 'pre-wrap' }]}
                        className="text-base leading-6 text-gray-800 dark:text-gray-200"
                    >
                        {inlineBuffer}
                    </Text>
                );
                inlineBuffer = [];
            }
        };

        rawParts.forEach((p, i) => {
            // Count words in the current part
            if (p.content) {
                const wordsInPart = p.content.trim().split(/\s+/).length;
                totalWordCount += wordsInPart;
            }

            if (p.type === "text") {
                inlineBuffer.push(p.content);
            } else if (p.type === "br") {
                inlineBuffer.push("\n");
            } else if (p.type === "link") {
                inlineBuffer.push(
                    <Text
                        key={`link-${i}`}
                        onPress={() => handlePress(p.url)}
                        className="text-blue-500 font-bold underline"
                        style={{ lineHeight: 24 }}
                    >
                        {p.content}
                    </Text>
                );
            } else {
                flushInlineBuffer(i);

                if (p.type === "heading") {
                    finalElements.push(
                        <Text key={i} style={mobileStyle} className="text-xl font-bold mt-4 mb-1 text-black dark:text-white">
                            {p.content}
                        </Text>
                    );
                } else if (p.type === "listItem") {
                    finalElements.push(
                        <View key={i} className="flex-row items-start ml-4 my-0.5">
                            <Text style={mobileStyle} className="mr-2 text-base">•</Text>
                            <Text style={mobileStyle} className="flex-1 text-base leading-6 text-gray-800 dark:text-gray-200">{p.content}</Text>
                        </View>
                    );
                } else if (p.type === "section") {
                    finalElements.push(
                        <View key={i} className="bg-gray-100 dark:bg-gray-700 px-3 py-2.5 my-2 rounded-md border-l-4 border-blue-500">
                            <Text style={mobileStyle} className="text-base italic leading-6 text-gray-800 dark:text-gray-200">{p.content}</Text>
                        </View>
                    );
                }
            }

            // Check if we should inject an ad after this block/part
            if (totalWordCount >= nextAdThreshold) {
                flushInlineBuffer(`ad-flush-${i}`); // Ensure text before ad is rendered
                // finalElements.push(renderInArticleAd(i));
                nextAdThreshold += WORD_THRESHOLD; // Set next target (400, 600, etc.)
            }
        });

        flushInlineBuffer("end");

        return <View className="px-4 py-1">{finalElements}</View>;
    };

    const getTikTokEmbedUrl = (url) => {
        if (!url) return "";
        if (url.includes("tiktok.com/embed/")) return url;
        try {
            const match = url.match(/\/video\/(\d+)/);
            if (match && match[1]) return `https://www.tiktok.com/embed/${match[1]}`;
            return url;
        } catch (err) {
            return url;
        }
    };

    const renderMediaContent = () => {
        if (!post?.mediaUrl) return null;
        const url = post.mediaUrl.toLowerCase();
        const isTikTok = url.includes("tiktok.com");
        const isVideo = post.mediaType?.startsWith("video") || url.match(/\.(mp4|mov|m4v)$/i);

        if (isTikTok) {
            return (
                <View className="w-full rounded-2xl overflow-hidden my-2 bg-black relative" style={{ height: 600 }}>
                    <WebView
                        source={{ uri: getTikTokEmbedUrl(post.mediaUrl) }}
                        userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1"
                        scrollEnabled={false}
                        allowsFullscreenVideo
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        mixedContentMode="always"
                        style={{ flex: 1 }}
                        startInLoadingState={true}
                        renderLoading={() => (
                            <View style={{
                                position: 'absolute',
                                top: 0, left: 0, right: 0, bottom: 0,
                                justifyContent: 'center',
                                alignItems: 'center',
                                backgroundColor: '#000'
                            }}>
                                <ActivityIndicator color="#3b82f6" size="large" />
                                <Text className="text-white text-xs mt-3 font-bold animate-pulse">
                                    Fetching TikTok...
                                </Text>
                            </View>
                        )}
                    />
                </View>
            );
        }

        return (
            <Pressable
                onPress={() => !isVideo ? setLightbox({ open: true, src: post.mediaUrl, type: "image" }) : null}
                className="my-2 rounded-2xl overflow-hidden shadow-sm"
            >
                {isVideo ? (
                    <Video
                        source={{ uri: post.mediaUrl }}
                        style={{ width: '100%', height: 250 }}
                        useNativeControls
                        resizeMode="cover"
                    />
                ) : (
                    <Image
                        source={{ uri: post.mediaUrl }}
                        style={{ width: '100%', height: 300 }}
                        resizeMode="cover"
                    />
                )}
            </Pressable>
        );
    };

    return (
        <View className="bg-white dark:bg-gray-900 rounded-lg p-4 mb-5 shadow-sm border border-gray-100 dark:border-gray-800">

            {/* Header: Author & Views */}
            <View className="flex-row justify-between items-center">
                <Pressable
                    onPress={() => router.push(`/author/${post.authorId || post.authorUserId}`)}
                    className="flex-row items-center"
                >
                    {author.image ? (
                        <Image
                            source={{ uri: author.image }}
                            style={{ width: 40, height: 40, borderRadius: 20 }}
                            className="bg-gray-200 mr-2"
                            resizeMode="cover"
                        />
                    ) : (
                        <View
                            style={{ width: 40, height: 40, borderRadius: 20 }}
                            className="bg-blue-500 mr-2 items-center justify-center"
                        >
                            <Text className="text-white font-space-bold">
                                {author.name?.charAt(0).toUpperCase() || "?"}
                            </Text>
                        </View>
                    )}

                    <View className="">
                        <Text className="font-space-bold text-gray-900 dark:text-white text-base">
                            {author.name || "Anonymous"}
                        </Text>
                        <Text className="text-gray-400 text-xs font-space">Post Author</Text>
                    </View>
                </Pressable>
                <View className="flex-row items-center bg-gray-50 dark:bg-gray-800 px-3 py-1 rounded-full">
                    <Feather name="eye" size={12} color="#9ca3af" />
                    <Text className="ml-1.5 text-gray-500 text-xs font-medium">{totalViews}</Text>
                </View>
            </View>

            {/* Body: Title & Text */}
            <Pressable onPress={() => isFeed && router.push(`/post/${post.slug || post?._id}`)}>
                <Text className="text-2xl font-black text-gray-900 dark:text-white mb-2 leading-tight">
                    {post?.title}
                </Text>
                <View className="mb-1">{renderContent()}</View>
            </Pressable>

            {renderMediaContent()}

            {post.poll && <Poll poll={post.poll} postId={post?._id} deviceId={user?.deviceId} />}

            {/* Action Footer */}
            <View className="flex-row items-center justify-between border-t border-gray-50 dark:border-gray-800 pt-2 mt-2">
                <View className="flex-row items-center gap-2 space-x-6">
                    <Pressable onPress={handleLike} disabled={liked} className="flex-row items-center">
                        <Ionicons
                            name={liked ? "heart" : "heart-outline"}
                            size={22}
                            color={liked ? "#ef4444" : isDark ? "#fff" : "#1f2937"}
                        />
                        <Text className={`ml-1 font-bold ${liked ? "text-red-500" : "text-gray-600 dark:text-gray-400"}`}>{totalLikes}</Text>
                    </Pressable>

                    <View className="flex flex-row gap-1 items-center">
                        <Feather name="message-circle" size={18} color={isDark ? "#fff" : "#1f2937"} />
                        <Text key={totalComments}>{totalComments}</Text>
                    </View>
                </View>

                <Pressable onPress={handleNativeShare} className="p-2 bg-gray-50 dark:bg-gray-800 rounded-full">
                    <Feather name="share-2" size={18} color={isDark ? "#fff" : "#1f2937"} />
                </Pressable>
            </View>

            {/* Lightbox Modal */}
            <Modal visible={lightbox.open} transparent animationType="fade">
                <Pressable className="flex-1 bg-black/95 justify-center items-center" onPress={() => setLightbox({ ...lightbox, open: false })}>
                    <Pressable onPress={() => setLightbox({ ...lightbox, open: false })} className="absolute top-12 right-6 p-2 bg-white/10 rounded-full">
                        <Feather name="x" size={24} color="white" />
                    </Pressable>
                    {lightbox.type === "image" ? (
                        <Image source={{ uri: lightbox.src }} className="w-full h-[80%]" resizeMode="contain" />
                    ) : (
                        <Video source={{ uri: lightbox.src }} className="w-full h-[80%]" useNativeControls resizeMode="contain" shouldPlay />
                    )}
                </Pressable>
            </Modal>
        </View>
    );
}
