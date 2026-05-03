import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { Link, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    DeviceEventEmitter,
    Linking,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    Switch, TextInput, TouchableOpacity,
    useColorScheme,
    View
} from "react-native";
import Toast from "react-native-toast-message";
import useSWR from "swr";
// ⚡️ Swapped to AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useMMKV } from "react-native-mmkv";
import AnimeLoading from "../../components/AnimeLoading";
import CoinIcon from "../../components/ClanIcon";
import { Text } from "../../components/Text";
import THEME from "../../components/useAppTheme";
import { useAlert } from "../../context/AlertContext";
import { useClan } from "../../context/ClanContext";
import { useCoins } from "../../context/CoinContext";
import { useStreak } from "../../context/StreakContext";
import { useUser } from "../../context/UserContext";
import apiFetch from "../../utils/apiFetch";
// ⚡️ MAX PREMIUM REANIMATED IMPORTS
import * as Haptics from 'expo-haptics';
import Animated, {
    Easing,
    FadeIn,
    FadeInDown,
    FadeInRight, FadeOutLeft,
    SlideInRight, SlideOutLeft,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withTiming,
    ZoomIn
} from "react-native-reanimated";
import ImageEditorModal from "../../components/ImageEditorModal";

// 🔹 Notification Handler Configuration
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

const COOLDOWN_NOTIFICATION_KEY = "cooldown_notification_id";
const API_BASE = "https://oreblogda.com/api";
const fetcher = (url) => apiFetch(url).then((res) => res.json());

// ===================== ⚡️ NEW RANK SYSTEM HELPERS ===========
export const AURA_TIERS = [
    { level: 1, req: 0, title: "E-Rank Novice", icon: "🌱", postLimit: 2 },
    { level: 2, req: 100, title: "D-Rank Operative", icon: "⚔️", postLimit: 3 },
    { level: 3, req: 300, title: "C-Rank Awakened", icon: "🔥", postLimit: 3 },
    { level: 4, req: 700, title: "B-Rank Elite", icon: "⚡", postLimit: 4 },
    { level: 5, req: 1500, title: "A-Rank Champion", icon: "🛡️", postLimit: 4 },
    { level: 6, req: 3000, title: "S-Rank Legend", icon: "🌟", postLimit: 5 },
    { level: 7, req: 6000, title: "SS-Rank Mythic", icon: "🌀", postLimit: 5 },
    { level: 8, req: 12000, title: "Monarch", icon: "👑", postLimit: 6 }, // Unlimited/Max
];

const resolveUserRank = (level) => {
    const safeLevel = Math.max(1, Math.min(8, level || 1));
    const currentTier = AURA_TIERS[safeLevel - 1];

    return {
        rankTitle: currentTier.title.replace(/ /g, "_").toUpperCase(),
        rankIcon: currentTier.icon,
        postLimit: currentTier.postLimit
    };
};

export default function AuthorDiaryDashboard() {
    const CustomAlert = useAlert();
    const storage = useMMKV()
    const { user, loading: contextLoading } = useUser();

    const { userClan, isInClan } = useClan();
    const { streak, refreshStreak } = useStreak();
    const fingerprint = user?.deviceId;
    const router = useRouter();
    const { coins, processTransaction, isProcessingTransaction } = useCoins();
    const notificationListener = useRef();
    const messageInputRef = useRef(null);

    // Form & System States
    const [title, setTitle] = useState("");
    const [message, setMessage] = useState("");

    // Category States
    const [category, setCategory] = useState("News");
    const [clanSubCategory, setClanSubCategory] = useState("General");

    const [mediaUrlLink, setMediaUrlLink] = useState("");
    const [selection, setSelection] = useState({ start: 0, end: 0 });
    const [showPreview, setShowPreview] = useState(false);
    const [hasPoll, setHasPoll] = useState(false);
    const [pollMultiple, setPollMultiple] = useState(false);
    const [pollOptions, setPollOptions] = useState(["", ""]);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [timeLeft, setTimeLeft] = useState("");
    const [additionalSlot, setAdditionalSlot] = useState(0);

    const [isEditorVisible, setIsEditorVisible] = useState(false);
    const [editingIndex, setEditingIndex] = useState(null);

    // Rank & Post Limit State
    const [userRank, setUserRank] = useState(() => resolveUserRank(user?.currentRankLevel || 1));
    const [canPostAgain, setCanPostAgain] = useState(false);

    const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);
    const [pickedImage, setPickedImage] = useState(false);

    // Draft restoring states
    const [saveStatus, setSaveStatus] = useState("synced");
    const [lastSavedTime, setLastSavedTime] = useState("");
    const [isOfflineMode, setIsOfflineMode] = useState(false);

    const [cachedTodayPosts, setCachedTodayPosts] = useState(null);
    const [firstPostModal, setFirstPostModal] = useState({ visible: false, stats: null, postData: null });
    // FIRST POST CINEMATIC STATES
    const [isFirstPostFlow, setIsFirstPostFlow] = useState(false);
    const [introStep, setIntroStep] = useState(0);
    const [showMissionLog, setShowMissionLog] = useState(false);
    const isDark = useColorScheme() == "dark"

    const CACHE_KEY_TODAY = `CACHE_TODAY_POSTS_${fingerprint}`;
    const DRAFT_KEY = `draft_${fingerprint}`;

    // =================================================================
    // 1. INTERCEPT: CHECK FOR FIRST POST FLAG
    // =================================================================
    useEffect(() => {
        const checkFirstPost = storage.getNumber("trigger_first_post");

        if (checkFirstPost !== 0 && checkFirstPost !== undefined) {
            setIsFirstPostFlow(true);
        }
    }, []);

    // =================================================================
    // 2. INITIALIZATION: RESTORE DRAFTS AND CACHED DATA
    // =================================================================
    useEffect(() => {
        if (!fingerprint) return;

        const restoreData = async () => {
            try {
                // A. Restore Draft Form
                const savedDraft = await AsyncStorage.getItem(DRAFT_KEY);
                if (savedDraft) {
                    const data = JSON.parse(savedDraft);
                    if (data.title) setTitle(data.title);
                    if (data.message) setMessage(data.message);
                    if (data.category) setCategory(data.category);
                    if (data.clanSubCategory) setClanSubCategory(data.clanSubCategory);
                    if (data.hasPoll) setHasPoll(data.hasPoll);
                    if (data.pollOptions) setPollOptions(data.pollOptions);
                    if (data.timestamp) setLastSavedTime(data.timestamp);
                }

                // B. Restore Cached Posts
                const savedPosts = await AsyncStorage.getItem(CACHE_KEY_TODAY);
                if (savedPosts) setCachedTodayPosts(JSON.parse(savedPosts));

                // C. Restore Extra Slot
                const savedSlot = await AsyncStorage.getItem("additionalSlot");
                if (savedSlot === "1") {
                    setAdditionalSlot(1);
                }
            } catch (err) {
                console.error("Restoration Error:", err);
            }
        };

        restoreData();
    }, [fingerprint, DRAFT_KEY, CACHE_KEY_TODAY]);

    // =================================================================
    // 3. DATA FETCHING & RANK SYNC
    // =================================================================

    // ⚡️ INSTANT RANK SYNC: Always use the level provided by the user context
    useEffect(() => {
        if (user?.currentRankLevel) {
            setUserRank(resolveUserRank(user.currentRankLevel));
        }
    }, [user?.currentRankLevel]);

    const { data: todayPostsData, mutate: mutateTodayPosts } = useSWR(
        user?.deviceId ? `/posts?author=${user.deviceId}&last24Hours=true` : null,
        fetcher,
        {
            refreshInterval: isOfflineMode ? 0 : 60000,
            fallbackData: cachedTodayPosts,
            onSuccess: (data) => {
                setIsOfflineMode(false);
                AsyncStorage.setItem(CACHE_KEY_TODAY, JSON.stringify(data));
            },
            onError: () => setIsOfflineMode(true)
        }
    );

    const todayPosts = useMemo(() => {
        return todayPostsData?.posts || cachedTodayPosts?.posts || [];
    }, [todayPostsData, cachedTodayPosts]);
    const last6HoursPosts = useMemo(() => {
        // 1. Safety check for data
        if (!todayPostsData?.posts || !Array.isArray(todayPostsData.posts)) return [];

        const SIX_HOURS_IN_MS = 6 * 60 * 60 * 1000;
        const now = Date.now();

        return todayPostsData.posts.filter(post => {
            // 2. Convert post date to timestamp
            const postDate = new Date(post.createdAt).getTime();

            // 3. Keep posts where the age is less than 6 hours
            return (now - postDate) < SIX_HOURS_IN_MS;
        });
    }, [todayPostsData]);
    const recentPostsCount = last6HoursPosts.length;
    const todayPost = todayPosts[0] || null;
    // const postsLast24h = todayPosts.length;

    // ⚡️ UPDATED MAX POSTS LOGIC: Reads directly from AURA_TIERS
    const maxPostsToday = isInClan ? userRank.postLimit + 2 + additionalSlot : userRank.postLimit + additionalSlot;

    // =================================================================
    // 4. DRAFT AUTO-SAVE LOGIC
    // =================================================================
    useEffect(() => {
        if (!fingerprint) return;

        setSaveStatus("saving");
        const timer = setTimeout(async () => {
            try {
                const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const draftData = {
                    title, message, category, clanSubCategory, hasPoll, pollOptions, timestamp: now
                };
                await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
                setLastSavedTime(now);
                setSaveStatus("synced");
            } catch (err) {
                console.error("Save Error:", err);
            }
        }, 1500);

        return () => clearTimeout(timer);
    }, [title, message, category, clanSubCategory, hasPoll, pollOptions, fingerprint, DRAFT_KEY]);

    const handleClearAll = useCallback(() => {
        CustomAlert(
            "Wipe Local Intel?",
            "This will permanently delete your current draft.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear Everything",
                    style: "destructive",
                    onPress: async () => {
                        setTitle(""); setMessage(""); setCategory("News"); setHasPoll(false);
                        setPollOptions(["", ""]); setMediaUrlLink(""); setPickedImage(false); setMediaList([]);
                        try {
                            await AsyncStorage.removeItem(DRAFT_KEY);
                            Toast.show({ type: 'info', text1: 'Intel cleared successfully.' });
                        } catch (e) { console.error("Clear error", e); }
                    }
                }
            ]
        );
    }, [CustomAlert, DRAFT_KEY]);

    // =================================================================
    // 5. NOTIFICATIONS & SYSTEM SETUP
    // =================================================================
    useEffect(() => {
        let isMounted = true;
        async function setupPush() {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            if (isMounted) setIsLoadingNotifications(false);
        }
        setupPush();
        notificationListener.current = Notifications.addNotificationReceivedListener(() => { });
        return () => {
            isMounted = false;
            if (notificationListener.current) notificationListener.current.remove();
        };
    }, []);

    useEffect(() => {
        if (Platform.OS === 'android') {
            Notifications.setNotificationChannelAsync('cooldown-timer', {
                name: 'Cooldown Reminders',
                importance: Notifications.AndroidImportance.HIGH,
                sound: 'default',
                vibrationPattern: [0, 250, 250, 250],
            });
        }
    }, []);

    /* TIMER LOGIC WITH SPAM PROTECTION */
    useEffect(() => {
        let interval;

        const getNextUnlockTime = () => {
            if (!todayPosts || todayPosts.length === 0) return null;
            const now = new Date().getTime();
            let minEndTime = Infinity;

            todayPosts.forEach(post => {
                const referenceTime = new Date(post.statusChangedAt || post.updatedAt || post.createdAt).getTime();
                let cooldownMs = 0;

                if (post.status === 'approved') cooldownMs = 6 * 60 * 60 * 1000;
                else if (post.status === 'rejected') cooldownMs = 2 * 60 * 60 * 1000;
                else return;

                const endTime = referenceTime + cooldownMs;
                if (endTime > now && endTime < minEndTime) {
                    minEndTime = endTime;
                }
            });

            return minEndTime === Infinity ? null : minEndTime;
        };

        const targetTime = getNextUnlockTime();

        if ((recentPostsCount >= 1) && targetTime) {
            const scheduleDoneNotification = async () => {
                const now = Date.now();
                const triggerInSeconds = Math.floor((targetTime - now) / 1000);

                if (triggerInSeconds <= 0) return;

                const lastScheduledStr = await AsyncStorage.getItem("LAST_SCHEDULED_TARGET");
                const lastScheduledTarget = lastScheduledStr ? parseInt(lastScheduledStr) : 0;

                if (Math.abs(lastScheduledTarget - targetTime) < 5000) return;

                const existingId = await AsyncStorage.getItem(COOLDOWN_NOTIFICATION_KEY);
                if (existingId) {
                    try {
                        await Notifications.cancelScheduledNotificationAsync(existingId);
                    } catch (e) { }
                }

                try {
                    const notificationId = await Notifications.scheduleNotificationAsync({
                        content: {
                            title: "Cooldown Finished! 🎉",
                            body: "A post slot has opened up. Share your intel now!",
                            sound: 'default',
                            priority: 'high',
                            data: { type: "open_diary" },
                            android: {
                                channelId: "cooldown-timer",
                                groupKey: "com.oreblogda.COOLDOWN_GROUP",
                                summaryArgument: "New slots available",
                            },
                            threadIdentifier: "com.oreblogda.COOLDOWN_GROUP"
                        },
                        trigger: {
                            channelId: 'cooldown-timer',
                            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                            seconds: triggerInSeconds,
                            repeats: false,
                        },
                    });

                    await AsyncStorage.setItem(COOLDOWN_NOTIFICATION_KEY, notificationId);
                    await AsyncStorage.setItem("LAST_SCHEDULED_TARGET", targetTime.toString());
                } catch (error) { }
            };

            scheduleDoneNotification();

            const calculateTime = () => {
                if (interval) clearInterval(interval);
                interval = setInterval(() => {
                    const now = new Date().getTime();
                    const distance = targetTime - now;

                    if (distance <= 0) {
                        clearInterval(interval);
                        setTimeLeft("00:00:00");
                        setCanPostAgain(true);
                    } else {
                        const h = Math.floor(distance / (1000 * 60 * 60));
                        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                        const s = Math.floor((distance % (1000 * 60)) / 1000);
                        setTimeLeft(`${h}h ${m}m ${s}s`);
                        setCanPostAgain(false);
                    }
                }, 1000);
            };
            calculateTime();
        } else {
            setCanPostAgain(true);
            setTimeLeft("");
        }

        return () => { if (interval) clearInterval(interval); };
    }, [todayPosts, recentPostsCount]);

    // =================================================================
    // 5. HELPER FUNCTIONS (Formatting, Uploading, etc)
    // =================================================================
    const addPollOption = () => setPollOptions([...pollOptions, ""]);
    const removePollOption = (index) => setPollOptions(pollOptions.filter((_, i) => i !== index));
    const updatePollOption = (text, index) => { const newOptions = [...pollOptions]; newOptions[index] = text; setPollOptions(newOptions); };

    const sanitizeMessage = (text) => text;

    const insertTag = (tagType) => {
        let tagOpen = "", tagClose = "";
        switch (tagType) {
            case 'section': tagOpen = "s("; tagClose = ")"; break;
            case 'heading': tagOpen = "h("; tagClose = ")"; break;
            case 'link': tagOpen = "link(url)-text("; tagClose = ")"; break;
            case 'list': tagOpen = "l("; tagClose = ")"; break;
        }

        const before = message.substring(0, selection.start);
        const after = message.substring(selection.end);
        const middle = message.substring(selection.start, selection.end);

        const content = middle.length > 0 ? middle : (tagType === 'link' ? "Link Text" : "Add text here");

        const newText = `${before}${tagOpen}${content}${tagClose}${after}`;
        const cursorPosition = before.length + tagOpen.length + content.length + tagClose.length;

        setMessage(newText);

        setTimeout(() => {
            if (messageInputRef.current) {
                messageInputRef.current.focus();
                setSelection({ start: cursorPosition, end: cursorPosition });
            }
        }, 50);
    };

    const [mediaList, setMediaList] = useState([]);
    const pickImage = async () => {
        const remainingSlots = 15 - mediaList.length;
        if (remainingSlots <= 0) {
            CustomAlert("Limit Reached", "You can only upload a maximum of 15 media files.");
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            allowsMultipleSelection: true,
            selectionLimit: remainingSlots,
            quality: 0.8,
        });

        if (!result.canceled) {
            const newMedia = result.assets.map(asset => ({
                localUri: asset.uri,
                type: asset.type === "video" ? "video" : "image",
                fileSize: asset.fileSize
            }));

            setMediaList(prev => [...prev, ...newMedia]);
            setPickedImage(true);
        }
    };

    const handleSaveEdit = (editedUri) => {
        const newList = [...mediaList];
        newList[editingIndex] = { ...newList[editingIndex], localUri: editedUri };
        setMediaList(newList);
        setIsEditorVisible(false);
        setEditingIndex(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    const removeMedia = (index) => {
        const updatedList = mediaList.filter((_, i) => i !== index);
        setMediaList(updatedList);
        if (updatedList.length === 0) setPickedImage(false);
    };

    const updateStreak = async (deviceId) => {
        if (!deviceId) throw new Error("Device ID is required");
        try {
            const res = await apiFetch(`/users/streak`, { method: "POST", body: JSON.stringify({ deviceId }), })
            if (!res.ok) { const error = await res.json(); throw new Error(error.message || "Failed to update streak"); }
            const data = await res.json();
            return data;
        } catch (err) { console.error("Streak update error:", err); return null; }
    }

    const handleSubmit = async () => {
        if (!title.trim() || !message.trim()) { CustomAlert("Error", "Title and Message are required."); return; }
        if (isOfflineMode) { CustomAlert("Offline", "Cannot transmit data while offline."); return; }
        if (hasPoll && (pollOptions[0] == "" || pollOptions.length < 2)) {
            CustomAlert("Error", "Polls require at least 2 option, disable poll if no options")
            return
        } else if (category == "Polls" && !hasPoll) {
            CustomAlert("Error", "Polls category are for posts that includes polls")
            return
        }
        setSubmitting(true);

        // ⚡️ NEURAL UPLINK TIMEOUT: Resolves after 10s so the user doesn't have to wait for server confirmation
        const timeoutPromise = new Promise((resolve) =>
            setTimeout(() => resolve({ isTimeout: true }), 10000)
        );

        try {
            const uploadAndSubmit = async () => {
                const finalMediaAssets = [];

                // 1. Process and upload media payloads to the cloud grid
                for (const item of mediaList) {
                    if (item.url) { // Already uploaded
                        finalMediaAssets.push(item);
                        continue;
                    }

                    const signRes = await apiFetch(`${API_BASE}/upload/sign`, { method: "POST" });
                    const signData = await signRes.json();
                    if (!signRes.ok) throw new Error("Sync failure: Cloud Satellite unreachable.");

                    const formData = new FormData();
                    formData.append("file", {
                        uri: item.localUri,
                        type: item.type === "video" ? "video/mp4" : "image/jpeg",
                        name: item.type === "video" ? "video.mp4" : "photo.jpg",
                    });
                    formData.append("api_key", signData.apiKey);
                    formData.append("timestamp", signData.timestamp);
                    formData.append("signature", signData.signature);
                    formData.append("folder", "posts");

                    const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${signData.cloudName}/${item.type}/upload`, {
                        method: "POST",
                        body: formData
                    });

                    const cloudData = await cloudRes.json();
                    if (!cloudRes.ok) throw new Error("Media Extraction Failed: Cloud grid rejection.");

                    let finalUrl = cloudData.secure_url;
                    const transform = item.type === "video" ? "c_limit,w_720,br_1.5m,q_auto,vc_auto" : "c_limit,w_1080,f_auto,q_auto";
                    finalUrl = finalUrl.replace("/upload/", `/upload/${transform}/`);

                    finalMediaAssets.push({ url: finalUrl, type: item.type });
                }

                // 2. Transmit final payload to the Great Library
                let finalCategory = category;
                let finalClanId = null;

                if (category === "Clan") {
                    finalCategory = `Clan-${clanSubCategory}`;
                    finalClanId = userClan?.tag;
                }

                const response = await apiFetch(`/posts`, {
                    method: "POST",
                    body: JSON.stringify({
                        title,
                        message,
                        category: finalCategory,
                        clanId: finalClanId,
                        media: finalMediaAssets,
                        mediaUrl: finalMediaAssets.length > 0 ? finalMediaAssets[0].url : mediaUrlLink || null,
                        mediaType: finalMediaAssets.length > 0 ? finalMediaAssets[0].type : (mediaUrlLink?.includes("video") ? "video" : "image"),
                        hasPoll,
                        pollMultiple,
                        pollOptions: hasPoll ? pollOptions.filter(opt => opt.trim() !== "").map(opt => ({ text: opt })) : [],
                        fingerprint
                    }),
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.message || "Failed to create post");
                return { ...data, isTimeout: false };
            };

            const result = await Promise.race([uploadAndSubmit(), timeoutPromise]);

            // ⚡️ OPTIMISTIC UPDATE: If server is slow, manually insert a "pending" post into the UI list
            if (result.isTimeout) {
                const optimisticPost = {
                    _id: `temp-${Date.now()}`,
                    title: title,
                    status: 'pending',
                    createdAt: new Date().toISOString()
                };
                mutateTodayPosts({ posts: [optimisticPost, ...todayPosts] }, false);
                CustomAlert("Success", "Neural transmission initiated. Your post is pending decryption in the archives.");
            } else {
                // Handle Actual Success
                if (result.isFirstPost && result.auraStats) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    setFirstPostModal({ visible: true, stats: result.auraStats, postData: result.post });
                } else {
                    CustomAlert("Success", "Your entry has been submitted for approval!");
                }
            }

            await AsyncStorage.removeItem(DRAFT_KEY);
            DeviceEventEmitter.emit("POST_CREATED_SUCCESS");
            updateStreak(fingerprint);
            refreshStreak();

            // Reset States
            setMediaList([]);
            setTitle("");
            setMessage("");
            setMediaUrlLink("");
            setPickedImage(false);

            if (!result.isTimeout) {
                mutateTodayPosts();
            }

            const baseLimit = isInClan ? userRank.postLimit + 2 : userRank.postLimit;

            if (additionalSlot === 1 && (todayPosts.length + 1) >= (baseLimit + 1)) {
                setAdditionalSlot(0);
                await AsyncStorage.setItem("additionalSlot", "0");
            }
        } catch (err) { CustomAlert("Error", err.message) }
        finally { setSubmitting(false); }
    };

    // 6. Preview Logic
    const parseMessageSections = (msg) => {
        const regex = /s\((.*?)\)|h\((.*?)\)|l\((.*?)\)|link\((.*?)\)-text\((.*?)\)|\[br\]/gs;
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
        return content.trim()
    }

    const renderPreviewContent = () => {
        const WORD_THRESHOLD = 90;
        let totalWordCount = 0;
        let nextAdThreshold = WORD_THRESHOLD;
        const mobileStyle = { includeFontPadding: false, textAlignVertical: 'center' };

        const handlePress = async (url) => {
            const supported = await Linking.canOpenURL(url);
            if (supported) await Linking.openURL(url);
            else CustomAlert("Invalid Link", "Cannot open this URL");
        };

        const rawParts = parseMessageSections(normalizePostContent(message));
        const finalElements = [];
        let inlineBuffer = [];

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
                    <TouchableOpacity
                        key={`link-${i}`}
                        onPress={() => handlePress(p.url)}
                        activeOpacity={0.7}
                        style={{
                            backgroundColor: 'rgba(59, 130, 246, 0.15)',
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 6,
                            borderWidth: 1,
                            borderColor: 'rgba(59, 130, 246, 0.3)',
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginHorizontal: 2,
                            top: 4, // Aligns the pill vertically with standard text line-height 
                        }}
                    >
                        <Feather
                            name="link-2"
                            size={12}
                            color="#60a5fa"
                            style={{ marginRight: 4 }}
                        />
                        <Text
                            style={{
                                color: '#60a5fa',
                                fontWeight: '900',
                                fontSize: 13,
                                textTransform: 'lowercase'
                            }}
                        >
                            {p.content}
                        </Text>
                        <Feather
                            name="external-link"
                            size={10}
                            color="#60a5fa"
                            style={{ marginLeft: 4, opacity: 0.6 }}
                        />
                    </TouchableOpacity>
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
                nextAdThreshold += WORD_THRESHOLD;
            }
        });

        flushInlineBuffer("end");
        return <View className="px-4 py-1">{finalElements}</View>;
    };

    const handleAdditionalSlot = async () => {
        if (coins < 20) {
            CustomAlert("Insufficient OC", "You need 20 OC 🪙 to purchase additional slot. Check back daily!")
            return;
        }
        const result = await processTransaction("spend", 'extra_slot')
        if (result.success) {
            CustomAlert("Success", "Additional slot purchased!")
            await AsyncStorage.setItem('additionalSlot', "1");
            setAdditionalSlot(1);
        } else {
            CustomAlert("Error", result.error || "Failed to purchase additional slot.");
        }
    }

    const renderMissionLog = () => {
        if (!todayPosts || todayPosts.length === 0) return null;

        return (
            <View className="mt-8">
                <View className="flex-row items-center mb-4 ml-1">
                    <Ionicons name="list" size={16} color={THEME.accent} className="mr-2" />
                    <Text className="text-xs font-black uppercase text-gray-500 tracking-widest">
                        Diary Archives{isOfflineMode ? "(CACHED)" : "(Last 24h)"}
                    </Text>
                </View>

                {todayPosts.map((post, index) => (
                    <View
                        key={post._id || index}
                        style={{ backgroundColor: THEME.card, borderColor: THEME.border }}
                        className="mb-3 p-4 rounded-2xl border flex-row items-center"
                    >
                        <View className="flex-1">
                            <Text className="font-black text-sm uppercase mb-1" numberOfLines={1}>{post.title}</Text>
                            <View className="flex-row items-center">
                                <View
                                    className={`w-1.5 h-1.5 rounded-full mr-2 ${post.status === 'approved' ? 'bg-green-500' :
                                        post.status === 'rejected' ? 'bg-red-500' : 'bg-yellow-500'
                                        }`}
                                />
                                <Text className={`text-[9px] font-black uppercase tracking-tighter ${post.status === 'approved' ? 'text-green-500' :
                                    post.status === 'rejected' ? 'text-red-500' : 'text-yellow-500'
                                    }`}>
                                    {post.status}
                                </Text>
                            </View>

                            {post.rejectionReason && (
                                <View className={`mt-2 p-2 rounded-lg border ${post.status === 'approved' ? 'bg-green-500/5 border-green-500/10' : 'bg-red-500/5 border-red-500/10'}`}>
                                    <Text className={`text-[10px] font-medium italic ${post.status === 'approved' ? 'text-green-400' : 'text-red-400'}`}>
                                        REASON: {post.rejectionReason}
                                    </Text>
                                </View>
                            )}
                        </View>

                        <View className="items-end">
                            <Text className="text-[8px] text-gray-600 font-bold">
                                {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                            <Ionicons
                                name={post.status === 'approved' ? "checkmark-circle" : post.status === 'rejected' ? "alert-circle" : "sync"}
                                size={18}
                                color={post.status === 'approved' ? "#22c55e" : post.status === 'rejected' ? "#ef4444" : "#eab308"}
                                style={{ marginTop: 4 }}
                            />
                        </View>
                    </View>
                ))}
            </View>
        );
    };

    if (contextLoading || submitting) {
        return <AnimeLoading
            tipType={"post"}
            message={submitting ? "Submitting" : uploading ? "Uploading" : "Loading"}
            subMessage={"Fetching Otaku diary"}
        />
    }

    const primaryTextColor = isDark ? '#ffffff' : '#0f172a';

    // =================================================================
    // ⚡️ RENDER 1: THE FIRST POST CINEMATIC OVERLAY
    // =================================================================
    if (isFirstPostFlow) {
        const handlePromptSelection = (selectedTitle, selectedMessage, selectedCategory) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            setTitle(selectedTitle);
            setCategory(selectedCategory)
            if (selectedMessage) setMessage(selectedMessage);

            setIntroStep(3);

            setTimeout(() => {
                storage.set("trigger_first_post", 0);
                setIsFirstPostFlow(false);
            }, 2500);
        };

        const HOOKS = [
            { title: "Hot Take: My top 3 overrated anime", icon: "fire", color: "#ef4444", category: "Review" },
            { title: "Who wins in a 1v1? (Discussion)", icon: "sword-cross", color: "#3b82f6", category: "Review" },
            { title: "I just started watching [Blank] and...", icon: "television-play", color: "#a855f7", category: "Review" },
            { title: "", custom: true, icon: "pencil", color: "#10b981", label: "I'll forge my own path" }
        ];

        return (
            <View style={{ flex: 1, backgroundColor: isDark ? '#020617' : '#f8fafc' }}>
                {/* ⚡️ FIX: Added ScrollView wrapper so nothing ever gets cut off */}
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* STEP 0: THE UPLINK */}
                    {introStep === 0 && (
                        <Animated.View entering={FadeInRight.duration(600).springify()} exiting={FadeOutLeft.duration(300)} className="items-center px-2">
                            {/* ⚡️ FIX: Reduced icon size and mb-10 to mb-6 */}
                            <Animated.View style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)', borderColor: THEME.accent, shadowColor: THEME.accent }} className="w-24 h-24 rounded-[32px] items-center justify-center mb-6 border-[3px] shadow-[0_0_40px_rgba(0,0,0,0.3)]">
                                <MaterialCommunityIcons name="satellite-uplink" size={48} color={THEME.accent} />
                            </Animated.View>

                            {/* ⚡️ FIX: Reduced mb-8 to mb-4 */}
                            <Text style={{ color: THEME.accent }} className="font-black text-[13px] uppercase tracking-[0.4em] mb-4 text-center opacity-90">
                                {">"} SYSTEM_READY
                            </Text>

                            {/* ⚡️ FIX: Reduced padding to p-6 and mb-12 to mb-6 */}
                            <View style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} className="w-full p-6 rounded-[30px] border shadow-2xl mb-6">
                                <PremiumTextReveal
                                    text={`Uplink established, ${user?.username || 'Operative'}.\n\nThe village is waiting to hear your voice. It is time for your first transmission.`}
                                    style={{ color: primaryTextColor, fontSize: 18, lineHeight: 26, fontWeight: '900', fontStyle: 'italic', textTransform: 'uppercase' }}
                                />
                            </View>

                            {/* ⚡️ FIX: Reduced py-5 to py-4 */}
                            <Pressable
                                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setIntroStep(1); }}
                                className="w-full py-4 rounded-[24px] flex-row justify-center items-center bg-blue-600 shadow-lg shadow-blue-500/50"
                            >
                                <Text className="font-black italic uppercase tracking-[0.3em] text-lg mr-3 text-white">
                                    Initiate Uplink
                                </Text>
                                <Ionicons name="arrow-forward" size={22} color="white" />
                            </Pressable>
                        </Animated.View>
                    )}

                    {/* STEP 1: TRANSMISSION PROTOCOLS */}
                    {introStep === 1 && (
                        <Animated.View entering={SlideInRight.duration(500).springify()} exiting={SlideOutLeft.duration(300)} className="w-full mb-10">
                            <View className="items-center mb-6">
                                <MaterialCommunityIcons name="shield-alert-outline" size={46} color={THEME.accent} className="mb-3" />
                                <Text className="text-2xl font-black italic uppercase text-center mb-2" style={{ color: primaryTextColor }}>
                                    Transmission Protocols
                                </Text>
                                <Text style={{ color: THEME.textSecondary }} className="font-black uppercase text-[10px] tracking-[0.2em] text-center opacity-80">
                                    Read carefully before broadcasting to the network.
                                </Text>
                            </View>

                            {/* ⚡️ FIX: Reduced mb-8 to mb-6 */}
                            <View className="space-y-3 mb-6">
                                {/* Rule 1: Formatting */}
                                <Animated.View entering={FadeInRight.delay(100).springify()} style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.8)', borderColor: isDark ? '#334155' : '#e2e8f0' }} className="border p-4 rounded-2xl flex-row items-center">
                                    <View style={{ backgroundColor: '#a855f720' }} className="w-12 h-12 rounded-full items-center justify-center mr-4">
                                        <MaterialCommunityIcons name="format-text" size={22} color="#a855f7" />
                                    </View>
                                    <View className="flex-1">
                                        <Text style={{ color: primaryTextColor }} className="font-black text-[12px] uppercase tracking-wider mb-1">Formatting & Preview</Text>
                                        <Text style={{ color: THEME.textSecondary }} className="text-[11px] font-bold leading-4">Use tags like s() and h() for effects. Always preview your intel before posting.</Text>
                                    </View>
                                </Animated.View>

                                {/* Rule 2: Media */}
                                <Animated.View entering={FadeInRight.delay(250).springify()} style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.8)', borderColor: isDark ? '#334155' : '#e2e8f0' }} className="border p-4 rounded-2xl flex-row items-center">
                                    <View style={{ backgroundColor: '#3b82f620' }} className="w-12 h-12 rounded-full items-center justify-center mr-4">
                                        <MaterialCommunityIcons name="multimedia" size={22} color="#3b82f6" />
                                    </View>
                                    <View className="flex-1">
                                        <Text style={{ color: primaryTextColor }} className="font-black text-[12px] uppercase tracking-wider mb-1">Media Payload</Text>
                                        <Text style={{ color: THEME.textSecondary }} className="text-[11px] font-bold leading-4">Attach up to 15 assets. Size limits: 25MB max for Video, 5MB max for Image.</Text>
                                    </View>
                                </Animated.View>

                                {/* Rule 3: Categories */}
                                <Animated.View entering={FadeInRight.delay(400).springify()} style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.8)', borderColor: isDark ? '#334155' : '#e2e8f0' }} className="border p-4 rounded-2xl flex-row items-center">
                                    <View style={{ backgroundColor: '#f59e0b20' }} className="w-12 h-12 rounded-full items-center justify-center mr-4">
                                        <MaterialCommunityIcons name="folder-network" size={22} color="#f59e0b" />
                                    </View>
                                    <View className="flex-1">
                                        <Text style={{ color: primaryTextColor }} className="font-black text-[12px] uppercase tracking-wider mb-1">Data Routing</Text>
                                        <Text style={{ color: THEME.textSecondary }} className="text-[11px] font-bold leading-4">Select the correct category or clan sub-channel. Misrouted data will be purged.</Text>
                                    </View>
                                </Animated.View>

                                {/* Rule 4: Polls */}
                                <Animated.View entering={FadeInRight.delay(550).springify()} style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.8)', borderColor: isDark ? '#334155' : '#e2e8f0' }} className="border p-4 rounded-2xl flex-row items-center">
                                    <View style={{ backgroundColor: '#10b98120' }} className="w-12 h-12 rounded-full items-center justify-center mr-4">
                                        <MaterialCommunityIcons name="poll" size={22} color="#10b981" />
                                    </View>
                                    <View className="flex-1">
                                        <Text style={{ color: primaryTextColor }} className="font-black text-[12px] uppercase tracking-wider mb-1">Polling Modules</Text>
                                        <Text style={{ color: THEME.textSecondary }} className="text-[11px] font-bold leading-4">Deploy polls to gather intel and initiate interactive votes with the community.</Text>
                                    </View>
                                </Animated.View>

                                {/* Rule 5: System Judgment */}
                                <Animated.View entering={FadeInRight.delay(700).springify()} style={{ backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.05)', borderColor: '#ef444450' }} className="border p-4 rounded-2xl flex-row items-center">
                                    <View style={{ backgroundColor: '#ef444420' }} className="w-12 h-12 rounded-full items-center justify-center mr-4">
                                        <MaterialCommunityIcons name="eye-outline" size={22} color="#ef4444" />
                                    </View>
                                    <View className="flex-1">
                                        <Text style={{ color: '#ef4444' }} className="font-black text-[12px] uppercase tracking-wider mb-1">System Judgment</Text>
                                        <Text style={{ color: THEME.textSecondary }} className="text-[11px] font-bold leading-4">All posts are decrypted by THE SYSTEM. Follow guidelines to avoid rejection.</Text>
                                    </View>
                                </Animated.View>
                            </View>

                            <Pressable
                                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setIntroStep(2); }}
                                className="w-full py-4 rounded-[24px] flex-row justify-center items-center bg-blue-600 shadow-lg shadow-blue-500/50"
                            >
                                <Text className="font-black italic uppercase tracking-[0.2em] text-sm mr-3 text-white">
                                    Acknowledge Protocols
                                </Text>
                                <Ionicons name="checkmark-done" size={20} color="white" />
                            </Pressable>
                        </Animated.View>
                    )}

                    {/* STEP 2: SELECT A HOOK */}
                    {introStep === 2 && (
                        <Animated.View entering={SlideInRight.duration(500).springify()} exiting={SlideOutLeft.duration(300)} className="w-full">
                            <Text className="text-3xl font-black italic uppercase text-center mb-2" style={{ color: primaryTextColor }}>
                                Select a Hook
                            </Text>
                            {/* ⚡️ FIX: Reduced mb-8 to mb-6 */}
                            <Text style={{ color: THEME.textSecondary }} className="font-black uppercase text-[10px] mb-6 tracking-[0.2em] text-center opacity-80">
                                Every legend starts with a single word. Pick a prompt to begin.
                            </Text>

                            <View className="space-y-3">
                                {HOOKS.map((hook, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        onPress={() => handlePromptSelection(hook.custom ? "" : hook.title, "", hook.category)}
                                        style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)', borderColor: hook.color }}
                                        className="w-full border-2 rounded-[24px] p-4 flex-row items-center shadow-lg"
                                    >
                                        <View style={{ backgroundColor: hook.color + '20' }} className="w-10 h-10 rounded-full items-center justify-center mr-4">
                                            <MaterialCommunityIcons name={hook.icon} size={20} color={hook.color} />
                                        </View>
                                        <View className="flex-1">
                                            <Text style={{ color: primaryTextColor }} className="font-black italic uppercase text-xs">
                                                {hook.custom ? hook.label : hook.title}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </Animated.View>
                    )}

                    {/* STEP 3: LOADING TRANSITION */}
                    {introStep === 3 && (
                        <Animated.View entering={ZoomIn.duration(600).springify()} className="items-center justify-center py-20">
                            <MaterialCommunityIcons name="shield-check" size={80} color="#22c55e" style={{ marginBottom: 30 }} />
                            <Text className="text-3xl font-black italic uppercase text-center leading-10 mb-8" style={{ color: primaryTextColor }}>
                                Hook Selected. Opening Interface...
                            </Text>
                            <ActivityIndicator size="large" color="#22c55e" />
                        </Animated.View>
                    )}
                </ScrollView>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: THEME.bg }}>
            <StatusBar barStyle="light-content" />

            {/* --- AMBIENT BACKGROUND GLOWS --- */}
            <View style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: 200, backgroundColor: THEME.glowBlue }} />
            <View style={{ position: 'absolute', bottom: -100, left: -100, width: 300, height: 300, borderRadius: 150, backgroundColor: THEME.glowRed }} />

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
                keyboardShouldPersistTaps="handled"
            >

                {/* --- HEADER --- */}
                <View className="flex-row justify-between items-end mt-6 mb-8 border-b border-gray-800 pb-6">
                    <View>
                        <View className="flex-row items-center mb-1">
                            <View
                                className={`h-2 w-2 rounded-full mr-2 ${isOfflineMode ? 'bg-orange-500' : 'bg-blue-600'}`}
                                style={{ shadowColor: isOfflineMode ? '#f97316' : '#2563eb', shadowRadius: 8, shadowOpacity: 0.8 }}
                            />
                            <Text className={`text-[10px] font-black uppercase tracking-[0.2em] ${isOfflineMode ? 'text-orange-500' : 'text-blue-600'}`}>
                                {isOfflineMode ? "ARCHIVED_DATA // OFFLINE" : "LIVE_UPLINK // ACTIVE"}
                            </Text>

                            <View className="ml-4 flex-row items-center bg-gray-900 px-2 py-0.5 rounded-full border border-gray-800">
                                {saveStatus === "saving" ? (
                                    <>
                                        <ActivityIndicator size={8} color={THEME.accent} className="mr-1" />
                                        <Text className="text-[8px] text-gray-500 font-black">SAVING...</Text>
                                    </>
                                ) : (
                                    <>
                                        <Ionicons name="cloud-done" size={10} color="#22c55e" style={{ marginRight: 4 }} />
                                        <Text className="text-[8px] text-green-500 font-black">SYNCED {lastSavedTime}</Text>
                                    </>
                                )}
                            </View>
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
                {additionalSlot <= 0 && recentPostsCount >= maxPostsToday && !canPostAgain ? (
                    <View>
                        <View style={{ backgroundColor: THEME.card, borderColor: THEME.border }} className="p-8 rounded-[40px] border items-center">
                            <View className={`w-20 h-20 rounded-full items-center justify-center mb-6 ${todayPost?.status === 'rejected' ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
                                <Ionicons name={todayPost?.status === 'rejected' ? "close-outline" : "time-outline"} size={40} color={todayPost?.status === 'rejected' ? THEME.red : THEME.accent} />
                            </View>

                            <Text className="text-2xl font-black uppercase italic text-white text-center">
                                Entry: {todayPost?.status?.toUpperCase() || "LOCKED"}
                            </Text>

                            <Text className="text-gray-500 text-center mt-3 leading-5 font-medium">
                                {todayPost?.status === 'pending' && "Your intel is currently being decrypted by THE SYSTEM."}
                                {todayPost?.status === 'approved' && "Daily transmission limit reached. Link available in:"}
                                {todayPost?.status === 'rejected' && "Transmission failed. System cooldown active:"}
                            </Text>

                            {(todayPost?.status === 'rejected' || todayPost?.status === 'approved') && (
                                <View className="items-center w-full">
                                    <View className="mt-6 flex-row items-center bg-black px-6 py-3 rounded-2xl border border-gray-800">
                                        <Ionicons name="timer-outline" size={18} color={THEME.accent} style={{ marginRight: 8 }} />
                                        <Text className="font-black text-xl text-blue-600">{timeLeft || "00:00"}</Text>
                                    </View>
                                </View>
                            )}

                            <Link href={todayPost?.status === "rejected" ? "/screens/Rules" : "/"} asChild>
                                <TouchableOpacity className="mt-4">
                                    <Text className="text-gray-600 font-bold uppercase tracking-tighter text-xs">
                                        {todayPost?.status === "rejected" ? "View Archive Rules" : "Return to Uplink"}
                                    </Text>
                                </TouchableOpacity>
                            </Link>
                            <TouchableOpacity
                                className="w-fit py-4 px-3 rounded-2xl flex-row items-center gap-1 justify-center space-x-2 mt-4"
                                onPress={handleAdditionalSlot}
                                style={{ backgroundColor: THEME.glowOrange }}
                                disabled={isProcessingTransaction}>
                                <Text className="text-yellow-500 font-bold uppercase tracking-tighter text-sm">Unlock + 1 slot 20</Text><CoinIcon type="OC" size={16} />
                            </TouchableOpacity>
                        </View>
                        {/* LOADING OVERLAY */}
                        {isProcessingTransaction && (
                            <View className="absolute inset-0 bg-black/60 flex items-center justify-center z-[100]">
                                <View style={{ backgroundColor: THEME.card }} className="p-10 rounded-[40px] items-center border-2 border-white/10">
                                    <ActivityIndicator size="large" color={THEME.accent} />
                                    <Text style={{ color: THEME.text }} className="font-black uppercase mt-4 tracking-widest text-xs">
                                        Syncing Wallet...
                                    </Text>
                                </View>
                            </View>
                        )}

                        {renderMissionLog()}
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
                                <Text className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Free Slots</Text>
                                <Text className="text-blue-500 font-black">{recentPostsCount} / {maxPostsToday} {additionalSlot == 1 && <Text className="text-yellow-500 text-[8px]">(+1 SLOT)</Text>} {isInClan && <Text className="text-yellow-500 text-[8px]">(+2 CLAN BONUS)</Text>} </Text>
                            </View>
                        </View>

                        {/* Mission Log Toggle */}
                        <TouchableOpacity
                            onPress={() => setShowMissionLog(!showMissionLog)}
                            className="mb-6 flex-row items-center justify-between bg-blue-600/5 p-4 rounded-2xl border border-blue-600/20"
                        >
                            <View className="flex-row items-center">
                                <Ionicons name="receipt-outline" size={20} color={THEME.accent} />
                                <Text className="font-black uppercase italic ml-3 text-xs text-white">Recent Posts</Text>
                            </View>
                            <Ionicons name={showMissionLog ? "chevron-up" : "chevron-down"} size={20} color={THEME.accent} />
                        </TouchableOpacity>

                        {showMissionLog && renderMissionLog()}

                        {/* --- FORM SECTION --- */}
                        <View className="flex-row justify-between items-center mb-6 mt-4">
                            <Text className="text-lg font-black uppercase italic text-white">{showPreview ? "Intel Preview" : "Create New Intel"}</Text>

                            <View className="flex-row gap-2">
                                <TouchableOpacity onPress={handleClearAll} className="bg-red-600/10 px-4 py-2 rounded-xl border border-red-600/20">
                                    <Text className="text-red-500 text-[10px] font-black uppercase">Clear All</Text>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={() => setShowPreview(!showPreview)} className="bg-blue-600/10 px-4 py-2 rounded-xl border border-blue-600/20">
                                    <Text className="text-blue-500 text-[10px] font-black uppercase">{showPreview ? "Edit Mode" : "Preview"}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {showPreview ? (
                            <View style={{ backgroundColor: THEME.card, borderColor: THEME.border }} className="mb-6 rounded-3xl border-2 p-2">{renderPreviewContent()}</View>
                        ) : (
                            <View className="space-y-6">
                                <View>
                                    <Text className="text-[12px] font-black uppercase text-gray-500 mb-2 ml-1">Subject Title</Text>
                                    <TextInput
                                        placeholder="ENTER POST TITLE..."
                                        value={title}
                                        onChangeText={setTitle}
                                        placeholderTextColor="#334155"
                                        style={{ backgroundColor: THEME.card, borderColor: THEME.border, color: THEME.text }}
                                        className="w-full border-2 p-5 rounded-2xl text-white font-black text-lg"
                                    />
                                </View>

                                <View>
                                    <View className="flex-col gap-1 mb-2 mt-2 px-1">
                                        <Text className="text-[13px] font-black uppercase text-gray-500">Content Module</Text>
                                        <View className="flex-row gap-2">
                                            <TouchableOpacity onPress={() => insertTag('section')}>
                                                <Text className="text-[11px] font-mono bg-blue-600/10 px-2 py-1 rounded text-blue-500 border border-blue-500/20">s(Section)</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => insertTag('heading')}>
                                                <Text className="text-[11px] font-mono bg-blue-600/10 px-2 py-1 rounded text-blue-500 border border-blue-500/20">h(Heading)</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => insertTag('list')}>
                                                <Text className="text-[11px] font-mono bg-blue-600/10 px-2 py-1 rounded text-blue-500 border border-blue-500/20">l(List)</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => insertTag('link')}>
                                                <Text className="text-[11px] font-mono bg-blue-600/10 px-2 py-1 rounded text-blue-500 border border-blue-500/20">Link</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <TextInput
                                        ref={messageInputRef}
                                        placeholder="Type your message here..."
                                        value={message}
                                        onChangeText={(text) => setMessage(sanitizeMessage(text))}
                                        onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                                        multiline
                                        style={{ backgroundColor: THEME.card, borderColor: THEME.border, textAlignVertical: 'top', color: THEME.text }}
                                        className="border-2 p-5 rounded-3xl font-medium h-64 text-white"
                                    />
                                </View>

                                <View className="mt-3">
                                    <Text className="text-[12px] font-black uppercase text-gray-500 mb-2 ml-1">Pick Category</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        {(isInClan ? ["Clan", "News", "Memes", "Fanart", "Polls", "Gaming", "Review"] : ["News", "Memes", "Fanart", "Polls", "Gaming", "Review"]).map((cat) => (
                                            <TouchableOpacity
                                                key={cat}
                                                onPress={() => setCategory(cat)}
                                                className={`mr-2 px-6 py-3 rounded-xl border ${category === cat ? 'bg-blue-600 border-blue-600' : 'bg-gray-900 border-gray-800'}`}
                                            >
                                                <Text style={{ color: "#fff" }} className={`text-[10px] font-black uppercase ${category === cat ? "text-white" : "text-gray-500"}`}>{cat}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>

                                    {category === "Clan" && (
                                        <View className="mt-4 bg-blue-600/5 p-4 rounded-xl border border-blue-600/20">
                                            <Text className="text-[9px] font-black uppercase text-blue-400 mb-2 ml-1">Select Clan Sub-Channel</Text>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                {["Memes", "News", "Fanart", "Polls", "Review", "Gaming"].map((subCat) => (
                                                    <TouchableOpacity
                                                        key={subCat}
                                                        onPress={() => setClanSubCategory(subCat)}
                                                        className={`mr-2 px-4 py-2 rounded-lg border ${clanSubCategory === subCat ? 'bg-blue-500 border-blue-500' : 'bg-gray-800 border-gray-700'}`}
                                                    >
                                                        <Text className={`text-[10px] font-bold uppercase ${clanSubCategory === subCat ? "text-white" : "text-gray-400"}`}>{subCat}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        </View>
                                    )}
                                </View>

                                <View className="space-y-4 mt-3">

                                    {mediaList.length > 0 && (
                                        <View className="mb-2">
                                            <Text className="text-[9px] font-black uppercase text-gray-500 mb-3 ml-1">Linked Assets ({mediaList.length}/15)</Text>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-2">
                                                {mediaList.map((item, index) => (
                                                    <View key={index} className="mr-3 relative">
                                                        <View
                                                            style={{ borderColor: THEME.border }}
                                                            className="w-[200px] h-[200px] rounded-2xl overflow-hidden border-2 bg-gray-900 justify-center items-center"
                                                        >
                                                            {item.type === "video" ? (
                                                                <Ionicons name="videocam" size={30} color={THEME.accent} />
                                                            ) : (
                                                                <Image style={{ width: "100%", height: "100%" }} source={{ uri: item.localUri || item.url }} contentFit="cover" />
                                                            )}
                                                        </View>
                                                        {/* ⚡️ ADDED REMOVE BUTTON */}
                                                        <TouchableOpacity
                                                            onPress={() => removeMedia(index)}
                                                            className="absolute -top-2 -right-2 bg-red-600 w-6 h-6 rounded-full items-center justify-center border-2 border-black z-50"
                                                        >
                                                            <Ionicons name="close" size={14} color="white" />
                                                        </TouchableOpacity>

                                                        {/* ⚡️ ADDED EDIT BUTTON FOR IMAGES */}
                                                        {item.type === "image" && (
                                                            <TouchableOpacity
                                                                onPress={() => {
                                                                    setEditingIndex(index);
                                                                    setIsEditorVisible(true);
                                                                }}
                                                                className="absolute bottom-2 right-2 bg-blue-600/80 w-8 h-8 rounded-xl items-center justify-center border border-white/20 z-50"
                                                            >
                                                                <Feather name="edit-2" size={16} color="white" />
                                                            </TouchableOpacity>
                                                        )}
                                                    </View>
                                                ))}
                                                {/* ⚡️ ADDED ADD BUTTON */}
                                                {mediaList.length < 15 && (
                                                    <TouchableOpacity
                                                        onPress={pickImage}
                                                        style={{ borderColor: THEME.border, backgroundColor: THEME.card }}
                                                        className="w-24 h-24 rounded-2xl border-2 border-dashed justify-center items-center self-center ml-2"
                                                    >
                                                        {uploading ? (
                                                            <ActivityIndicator color={THEME.accent} />
                                                        ) : (
                                                            <Ionicons name="add" size={24} color={THEME.accent} />
                                                        )}
                                                    </TouchableOpacity>
                                                )}
                                            </ScrollView>
                                        </View>
                                    )}

                                    {mediaList.length === 0 && (
                                        <TouchableOpacity
                                            onPress={pickImage}
                                            disabled={uploading}
                                            style={{ backgroundColor: THEME.card, borderColor: THEME.border }}
                                            className="p-8 rounded-3xl mt-3 items-center border-2 border-dashed"
                                        >
                                            {uploading ? (
                                                <View className="items-center">
                                                    <ActivityIndicator color={THEME.accent} />
                                                    <Text className="text-[10px] font-black uppercase mt-2 text-blue-500">Uploading to Cloud...</Text>
                                                </View>
                                            ) : (
                                                <View className="items-center">
                                                    <Ionicons name="cloud-upload-outline" size={24} color={pickedImage ? "#22c55e" : "#475569"} />
                                                    <Text className={`text-[10px] font-black uppercase mt-2 ${pickedImage ? 'text-green-500' : 'text-gray-500'}`}>
                                                        {pickedImage ? "Assets Linked Successfully" : "Sync Local Media Files (Max 15)"}
                                                    </Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    )}
                                </View>

                                <View style={{ backgroundColor: THEME.card, borderColor: hasPoll ? THEME.accent : THEME.border }} className="p-6 rounded-3xl border-2 mt-4">
                                    <View className="flex-row justify-between items-center mb-4">
                                        <Text className="font-black uppercase tracking-widest text-[11px] text-white">Deploy Poll Module</Text>
                                        <Switch
                                            value={hasPoll}
                                            onValueChange={setHasPoll}
                                            trackColor={{ false: '#3f3f46', true: '#2563eb' }}
                                            thumbColor={THEME.text}
                                        />
                                    </View>
                                    {hasPoll && (
                                        <View className="space-y-3">
                                            {pollOptions.map((option, i) => (
                                                <View key={i} className="flex-row items-center gap-2 mb-1">
                                                    <TextInput
                                                        placeholder={`Option ${i + 1}`}
                                                        value={option}
                                                        onChangeText={(t) => updatePollOption(t, i)}
                                                        placeholderTextColor="#4b5563"
                                                        style={{ backgroundColor: THEME.card, borderColor: THEME.border, color: THEME.text }}
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

            {/* ⚡️ FIRST POST SUCCESS MODAL */}
            <Modal visible={firstPostModal.visible} transparent animationType="fade">
                <View className="flex-1 bg-black/95 items-center justify-center p-6">
                    <Animated.View entering={ZoomIn.duration(600).springify()} className="w-full p-8 rounded-[40px] border border-blue-500/50 bg-[#0d1117] items-center relative overflow-hidden">

                        <View className="absolute top-0 left-0 w-4 h-4 rounded-full bg-blue-600/10" pointerEvents="none" />

                        <Animated.View entering={FadeInDown.delay(300)} className="w-24 h-24 bg-blue-600/20 rounded-full items-center justify-center mb-6 border border-blue-500/50">
                            <MaterialCommunityIcons name="auto-fix" size={40} color="#3b82f6" />
                        </Animated.View>

                        <Animated.Text entering={FadeInDown.delay(500)} className="text-2xl font-black text-center uppercase tracking-tighter text-white mb-2">
                            Transmission Successful!
                        </Animated.Text>

                        <Animated.Text entering={FadeInDown.delay(700)} className="text-blue-400 text-center font-bold text-xs uppercase tracking-widest mb-8">
                            First Scroll Etched
                        </Animated.Text>

                        <View className="mb-8 w-full min-h-[100px] justify-center items-center">
                            {firstPostModal.visible && (
                                <PremiumTextReveal
                                    key={firstPostModal.postData?._id || "reveal"}
                                    text={`Great! Your scroll was received and granted you +${firstPostModal.stats?.earned} AURA.\n\nYou have ${firstPostModal.stats?.pointsNeeded} Aura left to level up.\n\nYour journey has finally begun, Operator. Let's see how far you can go.`}
                                    style={{ color: '#9ca3af', fontSize: 15, lineHeight: 24, fontWeight: '700' }}
                                />
                            )}
                        </View>

                        <Animated.View entering={FadeIn.delay(3000).duration(800)} className="w-full">
                            <TouchableOpacity
                                onPress={() => {
                                    setFirstPostModal({ visible: false, stats: null, postData: null });
                                    if (firstPostModal.postData?._id) {
                                        router.push(`/post/${firstPostModal.postData.slug || firstPostModal.postData._id}`);
                                    }
                                }}
                                className="bg-blue-600 w-full p-5 rounded-2xl items-center shadow-lg shadow-blue-500/30"
                            >
                                <Text className="text-white font-black uppercase tracking-widest text-sm italic">
                                    View Transmission
                                </Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </Animated.View>
                </View>
            </Modal>

            {/* ⚡️ IMAGE EDITOR INTERFACE */}
            <ImageEditorModal
                isVisible={isEditorVisible}
                imageUri={editingIndex !== null ? mediaList[editingIndex]?.localUri : null}
                onClose={() => { setIsEditorVisible(false); setEditingIndex(null); }}
                onSave={handleSaveEdit}
            />
        </View>
    );
}

// ============================================================================
// ✍️ PREMIUM CINEMATIC WORD REVEAL (From Onboarding)
// ============================================================================
const AnimatedWord = ({ word, index, style }) => {
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(10)

    useEffect(() => {
        const timer = setTimeout(() => { Haptics.selectionAsync(); }, index * 150);
        opacity.value = withDelay(index * 150, withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }));
        translateY.value = withDelay(index * 150, withTiming(0, { duration: 600, easing: Easing.out(Easing.back(1.5)) }));
        return () => clearTimeout(timer);
    }, [word]);

    const animStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }]
    }));

    return <Animated.Text style={[style, animStyle, { marginRight: 6 }]}>{word}</Animated.Text>;
};

const PremiumTextReveal = ({ text, style }) => {
    const lines = text.split('\n');
    let globalWordIndex = 0;

    return (
        <View style={{ alignItems: 'center', width: '100%' }}>
            {lines.map((line, lineIndex) => (
                <View key={`line-${lineIndex}`} style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: line === '' ? 12 : 0 }}>
                    {line.split(' ').map((word, wIndex) => {
                        if (word === '') return null;
                        const currentIndex = globalWordIndex++;
                        return <AnimatedWord key={`word-${currentIndex}`} word={word} index={currentIndex} style={style} />;
                    })}
                </View>
            ))}
        </View>
    );
};
