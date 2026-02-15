import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { Link, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator, Alert,
    DeviceEventEmitter,
    Image,
    Linking,
    Platform,
    ScrollView,
    StatusBar,
    Switch, TextInput, TouchableOpacity,
    View,
} from "react-native";
import Toast from "react-native-toast-message";
import useSWR from "swr";
import { LevelPlayRewardedAd } from 'unity-levelplay-mediation';
import AnimeLoading from "../../components/AnimeLoading";
import { Text } from "../../components/Text";
import THEME from "../../components/useAppTheme";
import { useClan } from "../../context/ClanContext"; // 🔹 CLAN CONTEXT IMPORTED
import { useStreak } from "../../context/StreakContext";
import { useUser } from "../../context/UserContext";
import { AdConfig } from "../../utils/AdConfig";
import apiFetch from "../../utils/apiFetch";

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

// Helper to fetch total posts (logic kept separate, but result will be cached in component)
async function getUserTotalPosts(deviceId) {
    if (!deviceId) return 0;
    try {
        const res = await apiFetch(`/posts?author=${deviceId}`);
        if (!res.ok) throw new Error("Failed to fetch posts");
        const data = await res.json();

        return data?.total;
    } catch (err) {
        console.error("Error fetching total posts:");
        return null; // Return null on error to signal we should keep using cache
    }
}

/* ===================== RANK SYSTEM HELPERS ===========*/
const resolveUserRank = (totalPosts) => {
    // Fallback if totalPosts is null/undefined
    const count = totalPosts || 0;

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
        rankTitle === "Master_Writer" ? 5 :
            rankTitle === "Elite_Writer" ? 4 :
                rankTitle === "Senior_Writer" ? 4 :
                    rankTitle === "Novice_Writer" ? 3 :
                        rankTitle === "Senior_Researcher" ? 3 :
                            2;

    return { rankTitle, rankIcon, postLimit };
};

export default function AuthorDiaryDashboard() {
    const { user, loading: contextLoading } = useUser();
    const { userClan, isInClan } = useClan(); // 🔹 GET CLAN INFO
    const { streak } = useStreak();
    const fingerprint = user?.deviceId;
    const router = useRouter();

    // Use refs to store listeners so they can be cleaned up properly
    const notificationListener = useRef();

    // 🔹 NEW: Ref for the message input to fix keyboard issue
    const messageInputRef = useRef(null);

    // 🛠️ LEVELPLAY AD MANAGEMENT (Replaces useRewardedAd hook)
    const rewardedAdRef = useRef(null);
    const retryTimerRef = useRef(null);
    const [isAdLoaded, setIsAdLoaded] = useState(false);
    const [isAdLoading, setIsAdLoading] = useState(false); // For loading animation

    // Form & System States
    const [title, setTitle] = useState("");
    const [message, setMessage] = useState("");

    // 🔹 Category States
    const [category, setCategory] = useState("News");
    const [clanSubCategory, setClanSubCategory] = useState("General");

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

    // Rank & Post Limit State
    const [userRank, setUserRank] = useState({ rankTitle: "Novice_Researcher", rankIcon: "🛡️", postLimit: 2 });
    const [canPostAgain, setCanPostAgain] = useState(false);

    const [rewardToken, setRewardToken] = useState(null);
    const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);
    const [pickedImage, setPickedImage] = useState(false);

    // 🔹 CACHING & OFFLINE STATES
    const [isDraftRestoring, setIsDraftRestoring] = useState(true);
    const [saveStatus, setSaveStatus] = useState("synced"); // 'synced' | 'saving'
    const [lastSavedTime, setLastSavedTime] = useState("");
    const [isOfflineMode, setIsOfflineMode] = useState(false);

    // Data Caches
    const [cachedTodayPosts, setCachedTodayPosts] = useState(null);
    const [cachedRankData, setCachedRankData] = useState(null);

    // 🔹 NEW: Mission Log Toggle
    const [showMissionLog, setShowMissionLog] = useState(false);

    // Cache Keys
    const CACHE_KEY_TODAY = `CACHE_TODAY_POSTS_${fingerprint}`;
    const CACHE_KEY_RANK = `CACHE_RANK_${fingerprint}`;

    // =================================================================
    // 1. LEVELPLAY REWARDED AD LOGIC (REPLACEMENT)
    // =================================================================
    const REWARDED_ID = String(AdConfig.rewarded || "pw746blifv59mqoq").trim();
    useEffect(() => {
        if (REWARDED_ID === "0" || !fingerprint) return;

        const rewardedAd = new LevelPlayRewardedAd(REWARDED_ID);
        rewardedAdRef.current = rewardedAd;

        const listener = {
            onAdLoaded: (adInfo) => {
                setIsAdLoaded(true);
                setIsAdLoading(false);
                if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            },
            onAdLoadFailed: (error) => {
                console.warn("LevelPlay Load Failed:", error?.errorMessage);
                setIsAdLoaded(false);
                setIsAdLoading(true); // Keep spinner if you want to show it's retrying

                // Retry logic
                if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
                retryTimerRef.current = setTimeout(() => {
                    rewardedAd.loadAd();
                }, 10000);
            },
            onAdAvailable: (adInfo) => {
                setIsAdLoaded(true);
                setIsAdLoading(false);
                if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            },
            onAdUnavailable: () => setIsAdLoaded(false),
            onAdRewarded: async (reward, adInfo) => {
                // 🔹 PORTED FROM YOUR ADMOB LOGIC
                console.log("Reward Earned via LevelPlay");
                setRewardToken(`rewarded_${fingerprint}`);
                setCanPostAgain(true);
                try {
                    await Notifications.cancelAllScheduledNotificationsAsync();
                } catch (err) {
                    console.error("Failed to cancel notifications:", err);
                }
            },
            onAdClosed: (adInfo) => {
                // Reload ad immediately for next time
                rewardedAd.loadAd();
            },
            onAdShowFailed: (error, adInfo) => {
                Alert.alert("Ad Error", "Failed to display reward video.");
                rewardedAd.loadAd();
            }
        };

        rewardedAd.setListener(listener);
        rewardedAd.loadAd();

        return () => {
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        };
    }, [fingerprint]);

    // Manual Show Function (To be called by your button)
    const handleShowRewardAd = async () => {
        if (rewardedAdRef.current && await rewardedAdRef.current.isAdReady()) {
            rewardedAdRef.current.showAd("");
        } else {
            Toast.show({ type: 'error', text1: 'Ad not ready yet. Please wait.' });
            rewardedAdRef.current?.loadAd();
        }
    };

    // =================================================================
    // 2. INITIALIZATION: RESTORE DRAFTS AND CACHED DATA
    // =================================================================
    useEffect(() => {
        const prepare = async () => {
            if (!fingerprint) return;

            try {
                // A. Restore Draft Form
                const savedDraft = await AsyncStorage.getItem(`draft_${fingerprint}`);
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

                // C. Restore Cached Rank
                const savedRank = await AsyncStorage.getItem(CACHE_KEY_RANK);
                if (savedRank) {
                    const rankData = JSON.parse(savedRank);
                    setCachedRankData(rankData);
                    setUserRank(resolveUserRank(rankData));
                }

            } catch (err) {
                console.error("Restoration Error:", err);
            } finally {
                setTimeout(() => setIsDraftRestoring(false), 500);
            }
        };
        prepare();
    }, [fingerprint]);

    // =================================================================
    // 3. DATA FETCHING (OPTIMIZED WITH SWR & CACHING)
    // =================================================================
    useEffect(() => {
        const fetchTotalPosts = async () => {
            if (!user?.deviceId) return;
            const total = await getUserTotalPosts(user?.deviceId);
            if (total !== null) {
                const rank = resolveUserRank(total);
                setUserRank(rank);
                AsyncStorage.setItem(CACHE_KEY_RANK, JSON.stringify(total));
            }
        };
        fetchTotalPosts();
    }, [user?.deviceId]);

    const { data: todayPostsData, mutate: mutateTodayPosts, error: swrError } = useSWR(
        user?.deviceId ? `/posts?author=${user.deviceId}&last24Hours=true` : null,
        fetcher,
        {
            refreshInterval: isOfflineMode ? 0 : 5000,
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
    const todayPost = todayPosts[0] || null;

    const postsLast24h = todayPosts.length;
    const maxPostsToday = isInClan ? userRank.postLimit + 2 : userRank.postLimit;

    // =================================================================
    // 4. DRAFT AUTO-SAVE LOGIC
    // =================================================================
    useEffect(() => {
        if (isDraftRestoring || !fingerprint) return;

        setSaveStatus("saving");
        const timer = setTimeout(async () => {
            try {
                const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const draftData = {
                    title, message, category, clanSubCategory, hasPoll, pollOptions, timestamp: now
                };
                await AsyncStorage.setItem(`draft_${fingerprint}`, JSON.stringify(draftData));
                setLastSavedTime(now);
                setSaveStatus("synced");
            } catch (err) {
                console.error("Save Error:", err);
            }
        }, 1500);

        return () => clearTimeout(timer);
    }, [title, message, category, clanSubCategory, hasPoll, pollOptions, fingerprint, isDraftRestoring]);

    const handleClearAll = () => {
        Alert.alert(
            "Wipe Local Intel?",
            "This will permanently delete your current draft.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear Everything",
                    style: "destructive",
                    onPress: async () => {
                        setTitle(""); setMessage(""); setCategory("News"); setHasPoll(false);
                        setPollOptions(["", ""]); setMediaUrl(""); setMediaUrlLink(""); setPickedImage(false);
                        try {
                            await AsyncStorage.removeItem(`draft_${fingerprint}`);
                            Toast.show({ type: 'info', text1: 'Intel cleared successfully.' });
                        } catch (e) { console.error("Clear error", e); }
                    }
                }
            ]
        );
    };
//     const checkScheduledNotifications = async () => {
//   const scheduled = await Notifications.getAllScheduledNotificationsAsync();
//   console.log("Count:", scheduled.length);
//   console.log("Scheduled Notifications:", JSON.stringify(scheduled, null, 2));
// };

//      // Call this function to log scheduled notifications
//      useEffect(() => {
//       checkScheduledNotifications();
//     }, []);
    // =================================================================
    // 5. NOTIFICATIONS & SYSTEM SETUP
    // =================================================================
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
        notificationListener.current = Notifications.addNotificationReceivedListener(notification => { });
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


    /* 🔹 UPDATED TIMER LOGIC WITH SPAM PROTECTION */
    useEffect(() => {
        let interval;

        const getNextUnlockTime = () => {
            if (!todayPosts || todayPosts.length === 0) return null;
            const now = new Date().getTime();
            let minEndTime = Infinity;

            todayPosts.forEach(post => {
                const referenceTime = new Date(post.statusChangedAt || post.updatedAt || post.createdAt).getTime();
                let cooldownMs = 0;

                if (post.status === 'approved') {
                    cooldownMs = 24 * 60 * 60 * 1000;
                } else if (post.status === 'rejected') {
                    cooldownMs = 12 * 60 * 60 * 1000;
                } else {
                    return;
                }

                const endTime = referenceTime + cooldownMs;
                if (endTime > now && endTime < minEndTime) {
                    minEndTime = endTime;
                }
            });

            return minEndTime === Infinity ? null : minEndTime;
        };

        const targetTime = getNextUnlockTime();

        if ((postsLast24h >= 1) && targetTime) {

            const scheduleDoneNotification = async () => {
                if (rewardToken) return;

                const now = Date.now();
                const triggerInSeconds = Math.floor((targetTime - now) / 1000);

                if (triggerInSeconds <= 0) return;

                // 🚀 SPAM PREVENTION: Check if we already scheduled a notification for THIS target time
                const lastScheduledStr = await AsyncStorage.getItem("LAST_SCHEDULED_TARGET");
                const lastScheduledTarget = lastScheduledStr ? parseInt(lastScheduledStr) : 0;

                // If the targetTime is basically the same (within 5 seconds), don't reschedule
                if (Math.abs(lastScheduledTarget - targetTime) < 5000) {
                    return;
                }

                const existingId = await AsyncStorage.getItem(COOLDOWN_NOTIFICATION_KEY);
                if (existingId) {
                    try {
                        await Notifications.cancelScheduledNotificationAsync(existingId);
                    } catch (e) {
                        console.log("Error cancelling:", e);
                    }
                }

                try {
                    const notificationId = await Notifications.scheduleNotificationAsync({
                        content: {
                            title: "Cooldown Finished! 🎉",
                            body: "A post slot has opened up. Share your intel now!",
                            sound: 'default',
                            priority: 'high',
                            data: { type: "open_diary" },
                            // Grouping prevents the "4, 3, 2, 1" list effect on Android
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

                    // Store both the Notification ID AND the Target Time we scheduled for
                    await AsyncStorage.setItem(COOLDOWN_NOTIFICATION_KEY, notificationId);
                    await AsyncStorage.setItem("LAST_SCHEDULED_TARGET", targetTime.toString());

                    console.log(`📡 Notification scheduled for ${triggerInSeconds}s from now`);
                } catch (error) {
                    console.error("Failed to schedule notification:", error);
                }
            };

            scheduleDoneNotification();

            // Timer Interval for UI
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
                        if (!rewardToken) setCanPostAgain(false);
                    }
                }, 1000);
            };
            calculateTime();
        } else {
            setCanPostAgain(true);
            setTimeLeft("");
        }

        return () => { if (interval) clearInterval(interval); };
    }, [todayPosts, postsLast24h, rewardToken]); // 👈 Removed maxPostsToday to reduce unnecessary triggers




    // =================================================================
    // 5. HELPER FUNCTIONS (Formatting, Uploading, etc)
    // =================================================================
    const addPollOption = () => setPollOptions([...pollOptions, ""]);
    const removePollOption = (index) => setPollOptions(pollOptions.filter((_, i) => i !== index));
    const updatePollOption = (text, index) => { const newOptions = [...pollOptions]; newOptions[index] = text; setPollOptions(newOptions); };

    // 🔹 UPDATED: sanitizeMessage for new syntax s(), h(), l(), link()
    const sanitizeMessage = (text) => {
        let cleaned = text;
        return cleaned;
    };

    // 🔹 UPDATED: insertTag for Smart Wrapping & Keyboard Fix
    const insertTag = (tagType) => {
        let tagOpen = "", tagClose = "";

        // Define syntax
        switch (tagType) {
            case 'section':
                tagOpen = "s(";
                tagClose = ")";
                break;
            case 'heading':
                tagOpen = "h(";
                tagClose = ")";
                break;
            case 'link':
                tagOpen = "link(url)-text(";
                tagClose = ")";
                break;
            case 'list':
                tagOpen = "l(";
                tagClose = ")";
                break;
        }

        const before = message.substring(0, selection.start);
        const after = message.substring(selection.end);
        const middle = message.substring(selection.start, selection.end);

        // Smart Wrapping: If text is selected (middle exists), wrap it. 
        // If empty, add placeholder.
        const content = middle.length > 0 ? middle : (tagType === 'link' ? "Link Text" : "Add text here");

        const newText = `${before}${tagOpen}${content}${tagClose}${after}`;

        // Calculate new cursor position
        const cursorPosition = before.length + tagOpen.length + content.length + tagClose.length;

        setMessage(newText);

        // 🔹 KEYBOARD FIX: Focus back on the input programmatically
        setTimeout(() => {
            if (messageInputRef.current) {
                messageInputRef.current.focus();
                setSelection({ start: cursorPosition, end: cursorPosition });
            }
        }, 50);
    };
    const [mediaList, setMediaList] = useState([]); // Array of {url, type}
    const pickImage = async () => {
        const remainingSlots = 5 - mediaList.length;
        if (remainingSlots <= 0) {
            Alert.alert("Limit Reached", "You can only upload a maximum of 5 media files.");
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            allowsMultipleSelection: true, // Enable multi-selection
            selectionLimit: remainingSlots,
            quality: 0.5,
        });

        if (!result.canceled) {
            setUploading(true);
            try {
                const signRes = await apiFetch(`${API_BASE}/upload/sign`, { method: "POST" });
                const signData = await signRes.json();
                if (!signRes.ok) throw new Error("Signature fetch failed");

                const uploadedAssets = [];

                // Loop through selected assets
                for (const selected of result.assets) {
                    const isVideo = selected.type === "video";
                    const currentLimit = isVideo ? 15 * 1024 * 1024 : 5 * 1024 * 1024;

                    if (selected.fileSize > currentLimit) {
                        Alert.alert("File Too Large", `Skipping ${selected.type}. Max: ${isVideo ? '15MB' : '5MB'}.`);
                        continue;
                    }

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

                    const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${signData.cloudName}/${isVideo ? "video" : "image"}/upload`, {
                        method: "POST",
                        body: formData
                    });

                    const cloudData = await cloudRes.json();
                    if (cloudRes.ok) {
                        let finalUrl = cloudData.secure_url;
                        const transform = isVideo ? "q_auto,vc_auto" : "f_auto,q_auto";
                        finalUrl = finalUrl.replace("/upload/", `/upload/${transform}/`);

                        uploadedAssets.push({ url: finalUrl, type: isVideo ? "video" : "image" });
                    }
                }

                setMediaList(prev => [...prev, ...uploadedAssets]);
                setPickedImage(true);
                Toast.show({ type: 'success', text1: `${uploadedAssets.length} asset(s) linked!` });
            } catch (err) {
                console.error(err);
                Alert.alert("Error", "Upload failed: " + err.message);
            } finally {
                setUploading(false);
            }
        }
    };

    // 🔹 NEW: REMOVE MEDIA
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
    const { refreshStreak } = useStreak()

    // 🔹 UPDATED: SUBMIT HANDLER
    const handleSubmit = async () => {
        if (!title.trim() || !message.trim()) { Alert.alert("Error", "Title and Message are required."); return; }
        if (isOfflineMode) { Alert.alert("Offline", "Cannot transmit data while offline."); return; }

        setSubmitting(true);
        try {
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
                    // NEW: Send the full array
                    media: mediaList,
                    // BACKWARD COMPATIBILITY: Send first item as main media
                    mediaUrl: mediaList.length > 0 ? mediaList[0].url : mediaUrlLink || null,
                    mediaType: mediaList.length > 0 ? mediaList[0].type : (mediaUrlLink?.includes("video") ? "video" : "image"),
                    hasPoll,
                    pollMultiple,
                    pollOptions: hasPoll ? pollOptions.filter(opt => opt.trim() !== "").map(opt => ({ text: opt })) : [],
                    fingerprint,
                    rewardToken
                }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Failed to create post");

            await AsyncStorage.removeItem(`draft_${fingerprint}`);
            // 🚀 TRIGGER THE REVIEW LOGIC HERE
            DeviceEventEmitter.emit("POST_CREATED_SUCCESS");
            Alert.alert("Success", "Your entry has been submitted for approval!");
            updateStreak(fingerprint)
            // Reset States
            setMediaList([]);
            setTitle("");
            setMessage("");
            setMediaUrlLink("");
            setPickedImage(false);
            mutateTodayPosts();
        } catch (err) { Alert.alert("Error", err.message); }
        finally { setSubmitting(false); }
    };

    // 6. Preview Logic
    // 🔹 UPDATED: Parser for new syntax
    const parseMessageSections = (msg) => {
        // Regex for: s(), h(), l(), link()-text(), and [br]
        const regex = /s\((.*?)\)|h\((.*?)\)|l\((.*?)\)|link\((.*?)\)-text\((.*?)\)|\[br\]/gs;

        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(msg)) !== null) {
            // Push text before the match
            if (match.index > lastIndex) parts.push({ type: "text", content: msg.slice(lastIndex, match.index) });

            // Identify match type based on capture group index
            if (match[1] !== undefined) parts.push({ type: "section", content: match[1].trim() }); // s()
            else if (match[2] !== undefined) parts.push({ type: "heading", content: match[2].trim() }); // h()
            else if (match[3] !== undefined) parts.push({ type: "listItem", content: match[3].trim() }); // l()
            else if (match[4] !== undefined) parts.push({ type: "link", url: match[4], content: match[5] }); // link()-text()
            else parts.push({ type: "br" }); // [br] (if you still use it)

            lastIndex = regex.lastIndex;
        }
        if (lastIndex < msg.length) parts.push({ type: "text", content: msg.slice(lastIndex) });
        return parts;
    };

    // 🔹 UPDATED: cleanup function
    function normalizePostContent(content) {
        if (!content || typeof content !== "string") return content;
        // Simple trim for now, the new syntax is less prone to whitespace errors than the old tags
        return content.trim();
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

    // 🔹 Mission Log UI Component
    const renderMissionLog = () => {
        // Use cached/live mixed data
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

                            {/* Show Rejection Reason */}
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

    if (contextLoading || submitting || isDraftRestoring) {
        return <AnimeLoading
            message={submitting ? "Submitting" : uploading ? "Uploading" : isDraftRestoring ? "Restoring" : "Loading"}
            subMessage={isDraftRestoring ? "Synchronizing core draft modules..." : "Fetching Otaku diary"}
        />
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
                // Important for keyboard handling on scrolling
                keyboardShouldPersistTaps="handled"
            >

                {/* --- HEADER --- */}
                <View className="flex-row justify-between items-end mt-4 mb-8 border-b border-gray-800 pb-6">
                    <View>
                        <View className="flex-row items-center mb-1">
                            {/* 🔹 Offline/Online Status Indicator */}
                            <View
                                className={`h-2 w-2 rounded-full mr-2 ${isOfflineMode ? 'bg-orange-500' : 'bg-blue-600'}`}
                                style={{ shadowColor: isOfflineMode ? '#f97316' : '#2563eb', shadowRadius: 8, shadowOpacity: 0.8 }}
                            />
                            <Text className={`text-[10px] font-black uppercase tracking-[0.2em] ${isOfflineMode ? 'text-orange-500' : 'text-blue-600'}`}>
                                {isOfflineMode ? "ARCHIVED_DATA // OFFLINE" : "LIVE_UPLINK // ACTIVE"}
                            </Text>

                            {/* Sync Status Badge */}
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
                        <Text className="text-3xl font-black italic uppercase">
                            Welcome, <Text className="text-blue-600">{user?.username}</Text>
                        </Text>
                    </View>
                    <View className="bg-gray-900 px-3 py-1 rounded-lg border border-gray-800">
                        <Text style={{ color: "#fff" }} className="text-white font-bold text-xs">🔥 {streak?.streak || 0}</Text>
                    </View>
                </View>

                {/* --- POST LIMIT / STATUS VIEW --- */}
                {/* Checks both Live and Cached posts to determine UI state */}
                {postsLast24h >= maxPostsToday && !canPostAgain ? (
                    <View>
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
                                        onPress={handleShowRewardAd}
                                        className={`mt-8 w-full py-5 rounded-2xl flex-row justify-center items-center ${isAdLoaded ? 'bg-blue-600' : 'bg-gray-800'}`}
                                    >
                                        {isAdLoaded ? <Ionicons name="play" size={20} color="white" /> : <ActivityIndicator size="small" color="#444" />}
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
                                <Text className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Daily Quota</Text>
                                <Text className="text-blue-500 font-black">{postsLast24h} / {maxPostsToday} {isInClan && <Text className="text-yellow-500 text-[8px]">(+2 CLAN BONUS)</Text>}</Text>
                            </View>
                        </View>

                        {/* Mission Log Toggle */}
                        <TouchableOpacity
                            onPress={() => setShowMissionLog(!showMissionLog)}
                            className="mb-6 flex-row items-center justify-between bg-blue-600/5 p-4 rounded-2xl border border-blue-600/20"
                        >
                            <View className="flex-row items-center">
                                <Ionicons name="receipt-outline" size={20} color={THEME.accent} />
                                <Text className="font-black uppercase italic ml-3 text-xs">Recent Mission History</Text>
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
                                <Link href={"/screens/Instructions"} asChild>
                                    <TouchableOpacity className="mt-4">
                                        <Text className="text-gray-600 font-bold uppercase tracking-tighter text-xs">
                                            Don't understand how to go about this? Check out this page for clear explanation
                                        </Text>
                                    </TouchableOpacity>
                                </Link>
                                {/* Title */}
                                <View>
                                    <Text className="text-[9px] font-black uppercase text-gray-500 mb-2 ml-1">Subject Title</Text>
                                    <TextInput
                                        placeholder="ENTER POST TITLE..."
                                        value={title}
                                        onChangeText={setTitle}
                                        placeholderTextColor="#334155"
                                        style={{ backgroundColor: THEME.card, borderColor: THEME.border, color: THEME.text }}
                                        className="w-full border-2 p-5 rounded-2xl text-white font-black text-lg"
                                    />
                                </View>

                                {/* Message */}
                                <View>
                                    <View className="flex-col gap-1 mb-2 mt-2 px-1">
                                        <Text className="text-[13px] font-black uppercase text-gray-500">Content Module</Text>

                                        {/* 🔹 UPDATED: Formatting Buttons */}
                                        <View className="flex-row gap-2">
                                            {/* Using your new functional syntax logic */}
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

                                    {/* 🔹 UPDATED: TextInput with Ref for focus control */}
                                    <TextInput
                                        ref={messageInputRef} // Attached ref here
                                        placeholder="Type your message here..."
                                        value={message}
                                        onChangeText={(text) => setMessage(sanitizeMessage(text))}
                                        onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                                        multiline
                                        style={{ backgroundColor: THEME.card, borderColor: THEME.border, textAlignVertical: 'top', color: THEME.text }}
                                        className="border-2 p-5 rounded-3xl font-medium h-64"
                                    />
                                </View>

                                {/* 🔹 CATEGORY SELECTION (Updated for Clan Logic) */}
                                <View>
                                    <Text className="text-[9px] font-black uppercase text-gray-500 mb-2 ml-1">Archive Category</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        {/* 🔹 If in Clan, show 'Clan' as an option. Otherwise standard list. */}
                                        {(isInClan ? ["Clan", "News", "Memes", "Polls", "Gaming", "Review"] : ["News", "Memes", "Polls", "Gaming", "Review"]).map((cat) => (
                                            <TouchableOpacity
                                                key={cat}
                                                onPress={() => setCategory(cat)}
                                                className={`mr-2 px-6 py-3 rounded-xl border ${category === cat ? 'bg-blue-600 border-blue-600' : 'bg-gray-900 border-gray-800'}`}
                                            >
                                                <Text style={{ color: "#fff" }} className={`text-[10px] font-black uppercase ${category === cat ? "text-white" : "text-gray-500"}`}>{cat}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>

                                    {/* 🔹 SUB-CATEGORY SELECTION (Only visible if Clan is selected) */}
                                    {category === "Clan" && (
                                        <View className="mt-4 bg-blue-600/5 p-4 rounded-xl border border-blue-600/20">
                                            <Text className="text-[9px] font-black uppercase text-blue-400 mb-2 ml-1">Select Clan Sub-Channel</Text>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                {["Memes", "News", "Polls", "Review", "Gaming"].map((subCat) => (
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
                                {/* --- MEDIA & PREVIEW SECTION --- */}
                                <View className="space-y-4">
                                    <TextInput
                                        placeholder="External Uplink (URL)"
                                        value={mediaUrlLink}
                                        onChangeText={setMediaUrlLink}
                                        placeholderTextColor="#334155"
                                        style={{ backgroundColor: THEME.card, borderColor: THEME.border, color: THEME.text }}
                                        className="border-2 p-5 rounded-2xl text-white font-bold"
                                    />

                                    {/* 🔹 MULTI-MEDIA CAROUSEL PREVIEW */}
                                    {mediaList.length > 0 && (
                                        <View className="mb-2">
                                            <Text className="text-[9px] font-black uppercase text-gray-500 mb-3 ml-1">Linked Assets ({mediaList.length}/5)</Text>
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
                                                                <Image source={{ uri: item.url }} className="w-full h-full" contentFit="cover" />
                                                            )}
                                                        </View>
                                                        {/* Delete Button Badge */}
                                                        <TouchableOpacity
                                                            onPress={() => removeMedia(index)}
                                                            className="absolute -top-2 -right-2 bg-red-600 w-6 h-6 rounded-full items-center justify-center border-2 border-black"
                                                        >
                                                            <Ionicons name="close" size={14} color="white" />
                                                        </TouchableOpacity>
                                                    </View>
                                                ))}

                                                {/* Small "Add More" button if under limit */}
                                                {mediaList.length < 5 && (
                                                    <TouchableOpacity
                                                        onPress={pickImage}
                                                        style={{ borderColor: THEME.border, backgroundColor: THEME.card }}
                                                        className="w-24 h-24 rounded-2xl border-2 border-dashed justify-center items-center"
                                                    >
                                                        <Ionicons name="add" size={24} color={THEME.accent} />
                                                    </TouchableOpacity>
                                                )}
                                            </ScrollView>
                                        </View>
                                    )}

                                    {/* 🔹 UPLOAD BUTTON (Hidden if list has items and you want them to use the carousel 'add' button, or keep as main trigger) */}
                                    {mediaList.length === 0 && (
                                        <TouchableOpacity
                                            onPress={pickImage}
                                            disabled={uploading}
                                            style={{ backgroundColor: THEME.card, borderColor: THEME.border }}
                                            className="p-8 rounded-3xl items-center border-2 border-dashed"
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
                                                        {pickedImage ? "Assets Linked Successfully" : "Sync Local Media Files (Max 5)"}
                                                    </Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Poll Module */}
                                <View style={{ backgroundColor: THEME.card, borderColor: hasPoll ? THEME.accent : THEME.border }} className="p-6 rounded-3xl border-2 mt-4">
                                    <View className="flex-row justify-between items-center mb-4">
                                        <Text className="font-black uppercase tracking-widest text-[11px]">Deploy Poll Module</Text>
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