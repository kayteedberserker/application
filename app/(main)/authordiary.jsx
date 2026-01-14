import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { Link, useRouter } from "expo-router";

import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator, Alert,
    Linking,
    ScrollView,
    StatusBar,
    Switch, TextInput, TouchableOpacity,
    View
} from "react-native";
import { useRewardedAd } from 'react-native-google-mobile-ads';
import Toast from "react-native-toast-message";
import useSWR from "swr";
import AnimeLoading from "../../components/AnimeLoading";
import { Text } from "../../components/Text";
import THEME from "../../components/useAppTheme";
import { useStreak } from "../../context/StreakContext";
import { useUser } from "../../context/UserContext";
import { AdConfig } from "../../utils/AdConfig";

// 🔹 Notification Handler Configuration
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

const API_BASE = "https://oreblogda.com/api";
const fetcher = (url) => fetch(url).then((res) => res.json());

async function getUserTotalPosts(deviceId) {
    if (!deviceId) return 0;

    try {
        const res = await fetch(`${API_BASE}/posts?author=${deviceId}`);
        if (!res.ok) throw new Error("Failed to fetch posts");

        const data = await res.json();
        return data.posts?.length || 0;
    } catch (err) {
        console.error("Error fetching total posts:", err);
        return 0;
    }
}

/* ===================== RANK SYSTEM HELPERS ===========*/
const resolveUserRank = (totalPosts) => {
    const count = totalPosts;

    const rankTitle =
        count >= 200 ? "Master_Writer" :
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

    const postLimit =
        rankTitle === "Master_Writer" ? 3 :
            rankTitle === "Elite_Writer" ? 3 :
                rankTitle === "Senior_Writer" ? 2 :
                    rankTitle === "Novice_Writer" ? 2 :
                        rankTitle === "Senior_Researcher" ? 1 :
                            1;

    return { rankTitle, rankIcon, postLimit };
};

export default function AuthorDiaryDashboard() {
    const { user, loading: contextLoading } = useUser();
    const { streak } = useStreak();
    const fingerprint = user?.deviceId;
    const router = useRouter();

    // Use refs to store listeners so they can be cleaned up properly
    const notificationListener = useRef();

    // 1. Hook-based Ad Management
    const { isLoaded, isEarnedReward, isClosed, load, show } = useRewardedAd(AdConfig.rewarded, {
        requestNonPersonalizedAdsOnly: true,
    });

    // Form & System States
    const [title, setTitle] = useState("");
    const [message, setMessage] = useState("");
    const [category, setCategory] = useState("News");
    const [mediaUrl, setMediaUrl] = useState("");
    const [mediaUrlLink, setMediaUrlLink] = useState("");
    const [mediaType, setMediaType] = useState("image");
    const [selection, setSelection] = useState({ start: 0, end: 0 });
    const [showPreview, setShowPreview] = useState(false);
    const [hasPoll, setHasPoll] = useState(false);
    const [pollMultiple, setPollMultiple] = useState(false);
    const [pollOptions, setPollOptions] = useState(["", ""]);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [timeLeft, setTimeLeft] = useState("");
    const [userRank, setUserRank] = useState({ rankTitle: "Novice_Researcher", rankIcon: "🛡️", postLimit: 1 });
    const [canPostAgain, setCanPostAgain] = useState(false);
    const [rewardToken, setRewardToken] = useState(null);
    const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);
    const [pickedImage, setPickedImage] = useState(false);

    useEffect(() => {
        const fetchTotalPosts = async () => {
            if (!user?.deviceId) return;
            const total = await getUserTotalPosts(user?.deviceId);
            const rank = resolveUserRank(total);
            setUserRank(rank);
        };
        fetchTotalPosts()
    }, [user?.deviceId]);

    const maxPostsToday = userRank.postLimit;

    const { data: todayPostsData, mutate: mutateTodayPosts } = useSWR(
        user?.deviceId
            ? `${API_BASE}/posts?author=${user.deviceId}&last24Hours=true`
            : null,
        fetcher,
        { refreshInterval: 5000 }
    );

    const todayPosts = todayPostsData?.posts || [];
    const postsLast24h = todayPosts.length;
    const todayPost = todayPosts.length > 0 ? todayPosts[0] : null;

    // 🔹 2. Notification Permissions (Handling logic moved to _layout.js)
    useEffect(() => {
        let isMounted = true;

        async function registerForPushNotificationsAsync() {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            if (isMounted) setIsLoadingNotifications(false);
        }

        registerForPushNotificationsAsync();

        // We only listen for foreground notifications here if needed, 
        // but we DO NOT handle tap navigation here anymore.
        notificationListener.current = Notifications.addNotificationReceivedListener(notification => { });

        return () => {
            isMounted = false;
            if (notificationListener.current) {
                notificationListener.current.remove();
            }
        };
    }, []);

    // 3. Ad Lifecycle
    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (isEarnedReward) {
            const handleReward = async () => {
                setRewardToken(`rewarded_${fingerprint}`);
                setCanPostAgain(true);

                try {
                    await Notifications.cancelAllScheduledNotificationsAsync();
                } catch (err) {
                    console.error("Failed to cancel notifications:", err);
                }
            };
            handleReward();
        }
    }, [isEarnedReward, fingerprint]);

    useEffect(() => {
        if (isClosed) {
            load();
        }
    }, [isClosed, load]);

    // 4. Cooldown logic & Notification Scheduling
    useEffect(() => {
        let interval;
        if (todayPost && (todayPost.status === 'rejected' || todayPost.status === 'approved')) {

            const referenceTime = new Date(todayPost.statusChangedAt || todayPost.updatedAt).getTime();
            const TWELVE_HOURS = 12 * 60 * 60 * 1000;
            const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
            const cooldownMs = todayPost.status === 'approved' ? TWENTY_FOUR_HOURS : TWELVE_HOURS;

            const endTime = referenceTime + cooldownMs;

            const scheduleDoneNotification = async (targetTime) => {
                const triggerInSeconds = Math.floor((targetTime - new Date().getTime()) / 1000);

                if (triggerInSeconds > 0 && !rewardToken) {
                    await Notifications.cancelAllScheduledNotificationsAsync();

                    await Notifications.setNotificationChannelAsync('default', {
                        name: 'Default',
                        importance: Notifications.AndroidImportance.DEFAULT,
                    });

                    await Notifications.scheduleNotificationAsync({
                        content: {
                            title: "Cooldown Finished! 🎉",
                            body: "Your diary cooldown is over. You can post your next entry now!",
                            sound: true,
                            // 🔹 This data payload will be caught by the global handler in _layout.js
                            data: { type: "open_diary" } 
                        },
                        trigger: {
                            type: Notifications.SchedulableTriggerInputTypes.DATE,
                            date: new Date(targetTime),
                            channelId: 'default',
                        },
                    });
                }
            }

            scheduleDoneNotification(endTime);

            const calculateTime = () => {
                interval = setInterval(async () => {
                    const now = new Date().getTime();
                    const distance = endTime - now;
                    if (distance <= 0) {
                        clearInterval(interval);
                        setTimeLeft("00:00:00");
                        setCanPostAgain(true);
                    } else {
                        const h = Math.floor(distance / (1000 * 60 * 60));
                        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                        const s = Math.floor((distance % (1000 * 60)) / 1000);
                        setTimeLeft(`${h}h ${m}m ${s}s`);
                        if (!rewardToken) setCanPostAgain(false);
                    }
                }, 1000);
            };
            calculateTime();
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [todayPost, rewardToken]);

    // 5. Formatting & Handlers
    const addPollOption = () => setPollOptions([...pollOptions, ""]);
    const removePollOption = (index) => setPollOptions(pollOptions.filter((_, i) => i !== index));
    const updatePollOption = (text, index) => { const newOptions = [...pollOptions]; newOptions[index] = text; setPollOptions(newOptions); };

    const sanitizeMessage = (text) => {
        const patterns = [/\[section][\s\S]*?\[\/section]/g, /\[h][\s\S]*?\[\/h]/g, /\[li][\s\S]*?\[\/li]/g];
        let cleaned = text;
        patterns.forEach((pattern) => {
            const matches = cleaned.match(pattern);
            if (!matches) return;
            matches.forEach((block) => {
                const isBroken = !block.startsWith("[section]") && block.includes("section") || !block.startsWith("[h]") && block.includes("[h") || !block.startsWith("[li]") && block.includes("[li");
                if (isBroken) cleaned = cleaned.replace(block, "");
            });
        });
        return cleaned;
    };

    const insertTag = (tagType) => {
        let tagOpen = "", tagClose = "";
        switch (tagType) {
            case 'section': tagOpen = "[section]Add section text here "; tagClose = " [/section]"; break;
            case 'heading': tagOpen = "[h]Add heading text here"; tagClose = "[/h]"; break;
            case 'link': tagOpen = "[source=\"\link source here\" text:Link text here]"; tagClose = ""; break;
            case 'list': tagOpen = "[li]Input list text here"; tagClose = "[/li]"; break;
        }
        const before = message.substring(0, selection.start);
        const after = message.substring(selection.end);
        const middle = message.substring(selection.start, selection.end);
        const newText = `${before}${tagOpen}${middle}${tagClose}${after}`;
        const cursorPosition = before.length + tagOpen.length + middle.length;
        setMessage(newText);
        setTimeout(() => setSelection({ start: cursorPosition, end: cursorPosition }), 10);
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            allowsEditing: true,
            quality: 0.5
        });

        if (!result.canceled) {
            const selected = result.assets[0];
            const isVideo = selected.type === "video";
            const currentLimit = isVideo ? 15 * 1024 * 1024 : 5 * 1024 * 1024;

            if (selected.fileSize > currentLimit) {
                const sizeInMB = (selected.fileSize / (1024 * 1024)).toFixed(2);
                Alert.alert("File Too Large", `This ${selected.type} is ${sizeInMB}MB. Max: ${isVideo ? '15MB' : '5MB'}.`);
                return;
            }

            setUploading(true);

            try {
                const signRes = await fetch(`${API_BASE}/upload/sign`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" }
                });
                const signData = await signRes.json();
                if (!signRes.ok) throw new Error("Signature fetch failed");

                const formData = new FormData();
                formData.append("file", {
                    uri: selected.uri,
                    type: isVideo ? "video/mp4" : "image/jpeg",
                    name: isVideo ? "video.mp4" : "photo.jpg",
                });
                formData.append("api_key", signData.apiKey);
                formData.append("timestamp", signData.timestamp);
                formData.append("signature", signData.signature);
                formData.append("folder", "posts");

                const cloudRes = await fetch(
                    `https://api.cloudinary.com/v1_1/${signData.cloudName}/${isVideo ? "video" : "image"}/upload`,
                    { method: "POST", body: formData }
                );

                const cloudData = await cloudRes.json();

                if (cloudRes.ok) {
                    let finalUrl = cloudData.secure_url;
                    const transform = isVideo ? "q_auto,vc_auto" : "f_auto,q_auto";
                    finalUrl = finalUrl.replace("/upload/", `/upload/${transform}/`);

                    setMediaUrl(finalUrl);
                    setMediaType(isVideo ? "video" : "image");
                    setPickedImage(true);
                    Toast.show({ type: 'success', text1: 'Media attached successfully!' });
                } else {
                    throw new Error(cloudData.error?.message || "Cloudinary failed");
                }
            } catch (err) {
                console.error(err);
                Alert.alert("Error", "Upload failed: " + err.message);
            } finally {
                setUploading(false);
            }
        }
    };

    const updateStreak = async (deviceId) => {
        if (!deviceId) throw new Error("Device ID is required");
        try {
            const res = await fetch(`${API_BASE}/users/streak`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deviceId }),
            })
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to update streak");
            }
            const data = await res.json();
            return data;
        } catch (err) {
            console.error("Streak update error:", err);
            return null;
        }
    }
    const { refreshStreak } = useStreak()
    const handleSubmit = async () => {
        if (!title.trim() || !message.trim()) { Alert.alert("Error", "Title and Message are required."); return; }
        setSubmitting(true);

        try {
            const response = await fetch(`${API_BASE}/posts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title, message, category, mediaUrl: mediaUrl || mediaUrlLink || null,
                    mediaType: mediaUrl ? mediaType : (mediaUrlLink?.includes("video") ? "video" : "image"),
                    hasPoll, pollMultiple, pollOptions: hasPoll ? pollOptions.filter(opt => opt.trim() !== "").map(opt => ({ text: opt })) : [],
                    fingerprint,
                    rewardToken
                }),
            });
            const data = await response.json();
            updateStreak(fingerprint);
            if (!response.ok) throw new Error(data.message || "Failed to create post");
            Alert.alert("Success", "Your entry has been submitted for approval!");
            setRewardToken(null);
            setCanPostAgain(false);
            setTitle("");
            setMessage("");
            setMediaUrl("");
            setMediaUrlLink("");
            mutateTodayPosts();
            refreshStreak();
        } catch (err) { Alert.alert("Error", err.message); }
        finally { setSubmitting(false); setPickedImage(false) }
    };

    // 6. Preview Logic
    const parseMessageSections = (msg) => {
        const regex = /\[section\](.*?)\[\/section\]|\[h\](.*?)\[\/h\]|\[li\](.*?)\[\/li\]|\[source="(.*?)" text:(.*?)\]|\[br\]/gs;
        const parts = [];
        let lastIndex = 0;
        let match;
        while ((match = regex.exec(msg)) !== null) {
            if (match.index > lastIndex) parts.push({ type: "text", content: msg.slice(lastIndex, match.index) });
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

    function normalizePostContent(content) {
        if (!content || typeof content !== "string") return content;
        let cleaned = content
        cleaned = cleaned.replace(/\s+\[(h|li|section)\]/g, "[$1]");
        cleaned = cleaned.replace(/\[(h|li|section)\]\s+/g, "[$1]");
        cleaned = cleaned.replace(/\s+\[\/(h|li|section)\]/g, "[/$1]");
        cleaned = cleaned.replace(/\[\/(h|li|section)\]\s+/g, "[/$1]");
        return cleaned.trim();
    }

    const renderPreviewContent = () => {
        const WORD_THRESHOLD = 90;
        let totalWordCount = 0;
        let nextAdThreshold = WORD_THRESHOLD;
        const mobileStyle = { includeFontPadding: false, textAlignVertical: 'center' };

        const handlePress = async (url) => {
            const supported = await Linking.canOpenURL(url);
            if (supported) await Linking.openURL(url);
            else Alert.alert("Invalid Link", "Cannot open this URL");
        };

        const rawParts = parseMessageSections(normalizePostContent(message));
        const finalElements = [];
        let inlineBuffer = [];

        const renderInArticleAd = (key) => (
            <View key={`ad-${key}`} className="my-6 items-center py-4 border-y border-gray-100 dark:border-gray-800">
                <Text className="text-[10px] text-gray-400 mb-2 uppercase">Advertisement (Preview)</Text>
                <View className="bg-gray-200 w-[320px] h-[50px] items-center justify-center rounded">
                    <Text className="text-gray-400">Ad Placeholder</Text>
                </View>
            </View>
        );

        const flushInlineBuffer = (key) => {
            if (inlineBuffer.length > 0) {
                finalElements.push(
                    <Text key={`inline-${key}`} style={[mobileStyle, { whiteSpace: 'pre-wrap' }]} className="text-base leading-6 text-gray-800 dark:text-gray-200">
                        {inlineBuffer}
                    </Text>
                );
                inlineBuffer = [];
            }
        };

        rawParts.forEach((p, i) => {
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
                    <Text key={`link-${i}`} onPress={() => handlePress(p.url)} className="text-blue-500 font-bold underline" style={{ lineHeight: 24 }}>
                        {p.content}
                    </Text>
                );
            } else {
                flushInlineBuffer(i);
                if (p.type === "heading") {
                    finalElements.push(<Text key={i} style={mobileStyle} className="text-xl font-bold mt-4 mb-1 text-black dark:text-white">{p.content}</Text>);
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

            if (totalWordCount >= nextAdThreshold) {
                flushInlineBuffer(`ad-flush-${i}`);
                finalElements.push(renderInArticleAd(i));
                nextAdThreshold += WORD_THRESHOLD;
            }
        });

        flushInlineBuffer("end");
        return <View className="px-4 py-1">{finalElements}</View>;
    };

    if (contextLoading || submitting) {
        return <AnimeLoading message={submitting ? "Submitting" : uploading ? "Uploading" : "Loading"} subMessage="Fetching Otaku diary" />
    }
    return (
        <View style={{ flex: 1, backgroundColor: THEME.bg }}>
            <StatusBar barStyle="light-content" />

            {/* --- AMBIENT BACKGROUND GLOWS --- */}
            <View style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: 200, backgroundColor: THEME.glowBlue }} />
            <View style={{ position: 'absolute', bottom: -100, left: -100, width: 300, height: 300, borderRadius: 150, backgroundColor: THEME.glowRed }} />

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>

                {/* --- HEADER --- */}
                <View className="flex-row justify-between items-end mt-4 mb-8 border-b border-gray-800 pb-6">
                    <View>
                        <View className="flex-row items-center mb-1">
                            <View className="h-2 w-2 bg-blue-600 rounded-full mr-2" style={{ shadowColor: '#2563eb', shadowRadius: 8, shadowOpacity: 0.8 }} />
                            <Text className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Authorized Session</Text>
                        </View>
                        <Text className="text-3xl font-black italic uppercase text-white">
                            Welcome, <Text className="text-blue-600">{user?.username}</Text>
                        </Text>
                    </View>
                    <View className="bg-gray-900 px-3 py-1 rounded-lg border border-gray-800">
                        <Text style={{ color: "#fff" }} className="text-white font-bold text-xs">🔥 {streak?.streak || 0}</Text>
                    </View>
                </View>

                {/* --- POST LIMIT / STATUS VIEW --- */}
                {postsLast24h >= maxPostsToday && !canPostAgain ? (
                    <View style={{ backgroundColor: THEME.card, borderColor: THEME.border }} className="p-8 rounded-[40px] border items-center">
                        <View className={`w-20 h-20 rounded-full items-center justify-center mb-6 ${todayPost?.status === 'rejected' ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
                            <Ionicons name={todayPost?.status === 'rejected' ? "close-outline" : "time-outline"} size={40} color={todayPost?.status === 'rejected' ? THEME.red : THEME.accent} />
                        </View>

                        <Text className="text-2xl font-black uppercase italic text-white text-center">
                            Entry: {todayPost?.status?.toUpperCase() || "LOCKED"}
                        </Text>

                        <Text className="text-gray-500 text-center mt-3 leading-5 font-medium">
                            {todayPost?.status === 'pending' && "Your intel is currently being decrypted by our THE SYSTEM."}
                            {todayPost?.status === 'approved' && "Daily transmission limit reached. Link available in:"}
                            {todayPost?.status === 'rejected' && "Transmission failed. System cooldown active:"}
                        </Text>

                        {(todayPost?.status === 'rejected' || todayPost?.status === 'approved') && (
                            <View className="items-center w-full">
                                <View className="mt-6 flex-row items-center bg-black px-6 py-3 rounded-2xl border border-gray-800">
                                    <Ionicons name="timer-outline" size={18} color={THEME.accent} style={{ marginRight: 8 }} />
                                    <Text className="font-black text-xl text-blue-600">{timeLeft || "00:00"}</Text>
                                </View>

                                <TouchableOpacity
                                    onPress={() => isLoaded ? show() : load()}
                                    className={`mt-8 w-full py-5 rounded-2xl flex-row justify-center items-center ${isLoaded ? 'bg-blue-600' : 'bg-gray-800'}`}
                                >
                                    {isLoaded ? <Ionicons name="play" size={20} color="white" /> : <ActivityIndicator size="small" color="#444" />}
                                    <Text className="text-white font-black uppercase tracking-widest ml-2">Override Limit (Watch Ad)</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        <Link href={todayPost?.status === "rejected" ? "/screens/Rules" : "/"} asChild>
                            <TouchableOpacity className="mt-4">
                                <Text className="text-gray-600 font-bold uppercase tracking-tighter text-xs">
                                    {todayPost?.status === "rejected" ? "View Archive Rules" : "Return to Uplink"}
                                </Text>
                            </TouchableOpacity>
                        </Link>
                    </View>
                ) : (
                    <View>
                        {/* --- RANK & STATS --- */}
                        <View className="mb-8 flex-row justify-between items-center bg-gray-900/50 p-4 rounded-2xl border border-gray-800">
                            <View>
                                <Text className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Active Rank</Text>
                                <Text className="text-white font-black italic">{userRank.rankIcon} {userRank.rankTitle.toUpperCase()}</Text>
                            </View>
                            <View className="items-end">
                                <Text className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Daily Quota</Text>
                                <Text className="text-blue-500 font-black">{postsLast24h} / {maxPostsToday}</Text>
                            </View>
                        </View>

                        {/* --- FORM SECTION --- */}
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-lg font-black uppercase italic text-white">{showPreview ? "Intel Preview" : "Create New Intel"}</Text>
                            <TouchableOpacity onPress={() => setShowPreview(!showPreview)} className="bg-blue-600/10 px-4 py-2 rounded-xl border border-blue-600/20">
                                <Text className="text-blue-500 text-[10px] font-black uppercase">{showPreview ? "Edit Mode" : "Preview"}</Text>
                            </TouchableOpacity>
                        </View>

                        {showPreview ? (
                            <View style={{ backgroundColor: THEME.card, borderColor: THEME.border }} className="mb-6 rounded-3xl border-2 p-2">{renderPreviewContent()}</View>
                        ) : (
                            <View className="space-y-6">
                                {/* Title */}
                                <View>
                                    <Text className="text-[9px] font-black uppercase text-gray-500 mb-2 ml-1">Subject Title</Text>
                                    <TextInput
                                        placeholder="ENTER POST TITLE..."
                                        value={title}
                                        onChangeText={setTitle}
                                        placeholderTextColor="#334155"
                                        style={{ backgroundColor: THEME.card, borderColor: THEME.border, color: '#fff' }}
                                        className="w-full border-2 p-5 rounded-2xl text-white font-black text-lg"
                                    />
                                </View>

                                {/* Message */}
                                <View>
                                    <View className="flex-col gap-1 mb-2 mt-2 px-1">
                                        <Text className="text-[13px] font-black uppercase text-gray-500">Content Module</Text>
                                        <View className="flex-row gap-2">
                                            {['section', 'heading', 'list', 'link'].map(t => (
                                                <TouchableOpacity key={t} onPress={() => insertTag(t)}>
                                                    <Text className="text-[11px] font-mono bg-blue-600/10 px-2 py-1 rounded text-blue-500 border border-blue-500/20">[{t.toUpperCase()}]</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                    <TextInput
                                        placeholder="Type your message here..."
                                        value={message}
                                        onChangeText={(text) => setMessage(sanitizeMessage(text))}
                                        onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                                        multiline
                                        style={{ backgroundColor: THEME.card, borderColor: THEME.border, textAlignVertical: 'top', color: '#fff' }}
                                        className="border-2 p-5 rounded-3xl font-medium h-64"
                                    />
                                </View>

                                {/* Category Selection */}
                                <View>
                                    <Text className="text-[9px] font-black uppercase text-gray-500 mb-2 ml-1">Archive Category</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        {["News", "Memes", "Polls", "Gaming", "Review"].map((cat) => (
                                            <TouchableOpacity
                                                key={cat}
                                                onPress={() => setCategory(cat)}
                                                className={`mr-2 px-6 py-3 rounded-xl border ${category === cat ? 'bg-blue-600 border-blue-600' : 'bg-gray-900 border-gray-800'}`}
                                            >
                                                <Text style={{ color: "#fff" }} className={`text-[10px] font-black uppercase ${category === cat ? "text-white" : "text-gray-500"}`}>{cat}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>

                                {/* Media & URL */}
                                <View className="space-y-4">
                                    <TextInput
                                        placeholder="External Uplink (URL)"
                                        value={mediaUrlLink}
                                        onChangeText={setMediaUrlLink}
                                        placeholderTextColor="#334155"
                                        style={{ backgroundColor: THEME.card, borderColor: THEME.border, color: '#fff' }}
                                        className="border-2 p-5 rounded-2xl text-white font-bold"
                                    />

                                    <TouchableOpacity
                                        onPress={pickImage}
                                        style={{ backgroundColor: THEME.card, borderColor: THEME.border }}
                                        className="p-8 rounded-3xl items-center border-2 border-dashed"
                                    >
                                        {uploading ? <ActivityIndicator color="#2563eb" /> : (
                                            <View className="items-center">
                                                <Ionicons name="cloud-upload-outline" size={24} color={pickedImage ? "#22c55e" : "#475569"} />
                                                <Text className={`text-[10px] font-black uppercase mt-2 ${pickedImage ? 'text-green-500' : 'text-gray-500'}`}>
                                                    {pickedImage ? "Asset Linked Successfully" : "Sync Local Media File"}
                                                </Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                </View>

                                {/* Poll Module */}
                                <View style={{ backgroundColor: THEME.card, borderColor: hasPoll ? THEME.accent : THEME.border }} className="p-6 rounded-3xl border-2 mt-4">
                                    <View className="flex-row justify-between items-center mb-4">
                                        <Text className="text-white font-black uppercase tracking-widest text-[11px]">Deploy Poll Module</Text>
                                        <Switch value={hasPoll} onValueChange={setHasPoll} trackColor={{ true: '#2563eb' }} thumbColor="white" />
                                    </View>
                                    {hasPoll && (
                                        <View className="space-y-3">
                                            {pollOptions.map((option, i) => (
                                                <View key={i} className="flex-row items-center gap-2 mb-1">
                                                    <TextInput
                                                        placeholder={`Option ${i + 1}`}
                                                        value={option}
                                                        onChangeText={(t) => updatePollOption(t, i)}
                                                        style={{ backgroundColor: '#000', borderColor: THEME.border, color: '#fff' }}
                                                        className="flex-1 border p-4 rounded-xl text-white font-bold"
                                                    />
                                                    {pollOptions.length > 2 && <TouchableOpacity onPress={() => removePollOption(i)}><Ionicons name="close-circle" size={24} color={THEME.red} /></TouchableOpacity>}
                                                </View>
                                            ))}
                                            <TouchableOpacity onPress={addPollOption} className="bg-blue-600/10 p-4 rounded-xl items-center border border-dashed border-blue-600/30">
                                                <Text className="text-blue-500 font-black text-[10px] uppercase">+ Add Response</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>

                                {/* Final Submit */}
                                <TouchableOpacity
                                    onPress={handleSubmit}
                                    disabled={submitting || uploading}
                                    className={`bg-blue-600 py-6 rounded-3xl items-center mt-6 mb-10 shadow-2xl ${submitting ? 'opacity-50' : ''}`}
                                >
                                    {submitting ? <ActivityIndicator color="white" /> : <Text style={{ color: "#fff" }} className="text-white font-black italic uppercase tracking-[0.2em] text-lg">Transmit to Universe</Text>}
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>
        </View>
    );

}
