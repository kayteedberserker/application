import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
// 🌟 NEW: Added AndroidStyle
import notifee, { AndroidStyle, EventType } from '@notifee/react-native';
// 🌟 Import the modern components
import * as FileSystem from 'expo-file-system/legacy';
import { useFonts } from "expo-font";
import * as Linking from 'expo-linking';
import * as Notifications from "expo-notifications";
import { Stack, usePathname, useRootNavigationState, useRouter } from "expo-router";
import * as Updates from 'expo-updates';
import { useColorScheme } from "nativewind";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, DeviceEventEmitter, Platform, StatusBar, View } from "react-native";
import { useMMKV } from 'react-native-mmkv';
import Purchases from 'react-native-purchases';
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import Toast from 'react-native-toast-message';

import AnimeLoading from "../components/AnimeLoading";
import ProgressModal from "../components/ProgressModal";
import ReviewGate from "../components/ReviewGate";
import { AlertProvider } from '../context/AlertContext';
import { ClanProvider } from "../context/ClanContext";
import { CoinProvider } from "../context/CoinContext";
import { EventProvider } from "../context/EventContext";
import { UploadProgressProvider, useUploadProgress } from "../context/UploadProgressContext";
import { UserProvider, useUser } from "../context/UserContext";
import "./globals.css";

// 🛑 GLOBAL LOCKS
let IS_NAVIGATING_GLOBAL = false;
let LAST_PROCESSED_NOTIF_ID = null;
let LAST_PROCESSED_URL = null;
// 🔹 NOTIFICATION HANDLER
/**
 * GLOBAL NOTIFICATION HANDLER
 *
 * IMPORTANT:
 * Expo supports only ONE notification handler.
 * Do not call Notifications.setNotificationHandler()
 * anywhere else in the app.
 */
Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
        const { title, body, data } = notification.request.content;

        // 🌟 INSTANT LOGGING: See this immediately when a push arrives

        const groupId = data?.groupId;
        const mediaUrl = data?.mediaUrl || data?.fcm_options?.image;
        const authorPfpUrl = data?.authorPfp;

        try {
            if (mediaUrl || authorPfpUrl) {

                // Download both concurrently. Protected by the 2-second timeout.
                const [localPostImage, localPfpImage] = await Promise.all([
                    mediaUrl ? downloadNotificationImage(mediaUrl, 'media') : Promise.resolve(null),
                    authorPfpUrl ? downloadNotificationImage(authorPfpUrl, 'pfp') : Promise.resolve(null)
                ]);

                if (localPostImage || localPfpImage) {
                    await notifee.displayNotification({
                        title: title || "New Alert",
                        body: body || "",
                        data: data || {},
                        android: {
                            channelId: 'default',
                            smallIcon: 'notification_icon',
                            color: '#10B981',
                            largeIcon: localPfpImage || localPostImage,
                            style: localPostImage ? {
                                type: AndroidStyle.BIGPICTURE,
                                picture: localPostImage,
                            } : undefined,
                            pressAction: { id: 'default' },
                        },
                        ios: {
                            attachments: localPostImage
                                ? [{ url: localPostImage }]
                                : (localPfpImage ? [{ url: localPfpImage }] : [])
                        }
                    });

                    // Successfully displayed via Notifee, hide default Expo banner
                    return { shouldShowBanner: false, shouldPlaySound: true, shouldSetBadge: false };
                }
            }

            // Original fallback logic
            if (Platform.OS === 'android' && groupId) {
                return { shouldShowBanner: false, shouldPlaySound: false, shouldSetBadge: false };
            }
        } catch (error) {
            console.error("❌ Rich Notification Display Error:", error);
        }

        // Failsafe: Always show standard text banner if images fail
        return { shouldShowBanner: true, shouldPlaySound: true, shouldSetBadge: false };
    },
});
// ⚡️ REGISTER NOTIFEE FOREGROUND SERVICE & BACKGROUND EVENTS
if (Platform.OS === 'android') {
    notifee.registerForegroundService((notification) => {
        return new Promise((resolve) => { });
    });

    notifee.onBackgroundEvent(async ({ type, detail }) => {
        if (type === EventType.PRESS && detail.notification?.data) {
            if (__DEV__) console.log("Background Notification Pressed", detail.notification.data);
        }
    });
}

const REVENUE_CAT_API_KEYS = {
    ios: "goog_your_ios_key_here",
    android: "goog_cypWcXGzLgDujHkFvHTcUoqUNQi"
};

// 🌟 TIMEOUT FIX: Force the download to abort if it takes longer than 2 seconds
const downloadNotificationImage = async (url, prefix = 'notif') => {
    if (!url) return null;

    // Cloudinary optimization: Force JPG format for Notifee stability
    let targetUrl = url;
    if (targetUrl.includes('cloudinary.com')) {
        targetUrl = targetUrl.replace('.mp4', '.jpg').replace('/upload/', '/upload/w_600,q_auto,f_jpg/');
    }

    try {
        const uniqueHash = Math.floor(Math.random() * 1000000);
        const filename = `${prefix}_${Date.now()}_${uniqueHash}.jpg`;
        const fileUri = `${FileSystem.documentDirectory}${filename}`;
        const downloadPromise = FileSystem.downloadAsync(targetUrl, fileUri);
        const downloadResult = await Promise.race([downloadPromise]);

        let localUri = downloadResult.uri;
        if (localUri && !localUri.startsWith('file://')) {
            localUri = `file://${localUri}`;
        }

        return localUri;
    } catch (error) {
        console.error(`❌ Download failed for ${prefix}:`, error.message);
        return null; // Return null safely so the push doesn't crash
    }
};

// 🧠 ISOLATED CONTAINER CONSUMER TO BLOCK HIGH FREQUENCY OVERLAPS FROM THE ROOT
const IsolatedUploadProgress = React.memo(() => {
    const { uploadProgress, hideProgress } = useUploadProgress();

    return <ProgressModal visible={uploadProgress.isVisible} onDismiss={hideProgress} progress={uploadProgress} />;
});

function RootLayoutContent() {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";
    const router = useRouter();
    const pathname = usePathname();
    const { user } = useUser();
    const [minLoadDone, setMinLoadDone] = useState(false);

    const storage = useMMKV();

    const rootNavigationState = useRootNavigationState();
    const isNavigationReady = !!rootNavigationState?.key; // ⚡️ Check if navigation is mounted

    const [isUpdating, setIsUpdating] = useState(false);
    const [appReady, setAppReady] = useState(false);

    const appReadyRef = useRef(false);
    const pendingNavigation = useRef(null);

    useEffect(() => {
        const t = setTimeout(() => setMinLoadDone(true), 1200);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => { appReadyRef.current = appReady; }, [appReady]);

    // 🔹 REVENUECAT INITIALIZATION
    useEffect(() => {
        const setupRevenueCat = async () => {
            try {
                const isConfigured = await Purchases.isConfigured();
                if (!isConfigured) {
                    await Purchases.configure({
                        apiKey: Platform.OS === 'ios' ? REVENUE_CAT_API_KEYS.ios : REVENUE_CAT_API_KEYS.android
                    });
                }
                if (user?.uid || user?.id) {
                    await Purchases.logIn(user.uid || user.id);
                }
            } catch (e) {
                console.error("❌ RevenueCat Error:", e);
            }
        };
        setupRevenueCat();
    }, [user?.uid, user?.id]);

    // ⚡️ CACHE JANITOR
    useEffect(() => {
        const runCacheJanitor = () => {
            try {
                if (!storage) return;
                const allKeys = storage.getAllKeys();
                const targetPrefixes = ["POSTS_CACHE_", "CATEGORY_CACHE_", "clan_posts_", "WARS_", "CLAN_PROFILE_", "auth_cache_"];
                const expiredTime = 48 * 60 * 60 * 1000;
                const now = Date.now();
                const keysToReview = allKeys.filter(key => targetPrefixes.some(prefix => key.startsWith(prefix)));

                for (const key of keysToReview) {
                    const value = storage.getString(key);
                    if (!value) continue;
                    try {
                        const parsed = JSON.parse(value);
                        if (parsed?.timestamp && (now - parsed.timestamp > expiredTime)) {
                            storage.set(key, ""); // Clear expired cache
                        }
                    } catch (e) {
                        storage.set(key, ""); // Clear corrupted cache
                    }
                }
            } catch (err) { console.error("Janitor failed:", err); }
        };
        const timeout = setTimeout(runCacheJanitor, 30000);
        return () => clearTimeout(timeout);
    }, [storage]);

    const currentPathRef = useRef(pathname);
    useEffect(() => { currentPathRef.current = pathname; }, [pathname]);

    // 🔹 ROUTING PROCESSOR
    const processRouting = useCallback((data) => {
        if (!data) return;

        const currentNotifId = data.notificationId || data.id || JSON.stringify(data);

        // 🛡️ Guard against double processing and check if navigation is actually ready
        if (IS_NAVIGATING_GLOBAL || LAST_PROCESSED_NOTIF_ID === currentNotifId) return;

        if (!appReadyRef.current || !isNavigationReady) {
            if (__DEV__) console.log("⏳ Navigation not ready. Queueing...");
            pendingNavigation.current = data;
            return;
        }

        // 🌟 NEW: Check for exact screen or link route provided by the server first
        let targetPath = data.screen || data.body?.screen || data.link || data.body?.link || "";

        // Fallbacks for legacy/older notification structures
        const targetPostId = data.postId || data.id || data.body?.postId;
        const targetType = data.type || data.body?.type;
        const targetPage = data.page || data.body?.page;
        const targetDiscussionId = data.discussion || data.commentId;

        if (!targetPath || targetDiscussionId || targetPostId) {
            if (targetType === "open_diary" || targetType === "diary") {
                targetPath = "/authordiary";
            } else if (targetPostId) {
                targetPath = `/post/${targetPostId}`;
            } else if (targetType === "version_update") {
                targetPath = "/";
            } else if (targetType === "screen" && targetPage === "clanprofile") {
                targetPath = "/clanprofile";
            }
        }

        if (!targetPath) return;

        // Strip queries just to compare the base route for the 'same page' block
        const currentPathBase = currentPathRef.current.split('?')[0];
        const targetPathBase = targetPath.split('?')[0];

        if (currentPathBase === targetPathBase) {
            if (targetDiscussionId) {
                DeviceEventEmitter.emit("openCommentSection", { discussionId: targetDiscussionId });
            }
            return;
        }

        // 🌟 Append discussionId if missing but present in the payload
        let finalUrl = targetPath;
        if (targetDiscussionId && !finalUrl.includes('discussionId=')) {
            finalUrl += finalUrl.includes('?') ? `&discussionId=${targetDiscussionId}` : `?discussionId=${targetDiscussionId}`;
        }

        // ⚡️ Apply Global Lock
        IS_NAVIGATING_GLOBAL = true;
        LAST_PROCESSED_NOTIF_ID = currentNotifId;
        // ⚡️ Check if we are currently at the very beginning
        const isInitialRoute = currentPathRef.current === "/" || currentPathRef.current === "/index";
        requestAnimationFrame(() => {
            if (isInitialRoute) {
                // On cold starts, 'push' is often more reliable to ensure 
                // the navigation stack registers the transition correctly.
                router.push(finalUrl);
            } else {
                router.replace(finalUrl);
            }

            setTimeout(() => { IS_NAVIGATING_GLOBAL = false; }, 1000);
        });
    }, [router, isNavigationReady]);

    // 🔹 NATIVE EVENT LISTENERS
    useEffect(() => {
        const navSub = DeviceEventEmitter.addListener("navigateSafely", (targetPath) => {
            if (currentPathRef.current === targetPath) return;
            router.push(targetPath);
        });

        const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
            const currentPath = currentPathRef.current;
            const isAtHome = currentPath === "/" || currentPath === "/(tabs)" || currentPath === "/index";
            if (router.canGoBack()) {
                router.back();
                return true;
            }
            if (!isAtHome) {
                router.replace("/");
                return true;
            }
            return false;
        });

        return () => {
            navSub.remove();
            backHandler.remove();
        };
    }, [router]);

    useEffect(() => { setAppReady(true); }, []);

    // ⚡️ UPDATED FLUSH LOGIC
    useEffect(() => {
        // We only proceed if everything is ready AND the Stack is actually rendered
        if (appReady && isNavigationReady && minLoadDone && pendingNavigation.current) {
            const data = pendingNavigation.current;
            pendingNavigation.current = null;

            // Give the Stack a moment to actually mount its children
            const timer = setTimeout(() => {
                if (__DEV__) console.log("🚀 Flushing Cold Start Navigation");
                processRouting(data);
            }, 500); // 👈 Increased delay for stability on cold starts

            return () => clearTimeout(timer);
        }
    }, [appReady, isNavigationReady, minLoadDone, processRouting]);

    // 🔹 DEEP LINKING HANDLER
    useEffect(() => {
        const handleUrl = (url) => {
            if (!url || isUpdating || url === LAST_PROCESSED_URL) return;
            LAST_PROCESSED_URL = url;
            setTimeout(() => { LAST_PROCESSED_URL = null; }, 3000);

            const parsed = Linking.parse(url);
            const { path, queryParams } = parsed;

            if (path && path !== "/") {
                if (path.includes('post/')) {
                    const pathId = path.split('/').pop();
                    processRouting({ postId: pathId, type: 'post_detail', ...queryParams });
                } else if (currentPathRef.current !== `/${path}`) {
                    // 🌟 Keep path query params attached for deep links
                    router.replace({ pathname: `/${path}`, params: queryParams });
                }
            }
        };
        const subscription = Linking.addEventListener('url', (event) => handleUrl(event.url));
        return () => subscription.remove();
    }, [isUpdating, processRouting, router]);

    // 🔹 UPDATE CHECKER
    useEffect(() => {
        async function onFetchUpdateAsync() {
            if (__DEV__) return;
            try {
                const update = await Updates.checkForUpdateAsync();
                if (update.isAvailable) {
                    setIsUpdating(true);
                    await Updates.fetchUpdateAsync();
                    await Updates.reloadAsync();
                }
            } catch (error) { setIsUpdating(false); }
        }
        onFetchUpdateAsync();
    }, []);

    const [fontsLoaded] = useFonts({
        "SpaceGrotesk": require("../assets/fonts/SpaceGrotesk.ttf"),
        "SpaceGroteskBold": require("../assets/fonts/SpaceGrotesk.ttf"),
        ...Ionicons.font,
        ...MaterialCommunityIcons.font,
        ...FontAwesome.font,
    });

    // 🔹 NOTIFICATION LISTENERS
    const handleNotificationNavigation = useCallback((response) => {
        const data = response?.notification?.request?.content?.data || {};
        const notificationId = response?.notification?.request?.identifier;
        processRouting({ ...data, notificationId });
    }, [processRouting]);

    const handleNotifeeInteraction = useCallback(async (detail) => {
        const { notification, pressAction } = detail;
        if (pressAction?.id === 'default' && notification?.data) {
            processRouting({ ...notification.data, notificationId: notification.id });
        }
    }, [processRouting]);

    useEffect(() => {
        if (isUpdating) return;

        const unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
            if (type === EventType.PRESS) handleNotifeeInteraction(detail);
        });

        notifee.getInitialNotification().then(initialNotification => {
            if (initialNotification) handleNotifeeInteraction(initialNotification);
        });

        Notifications.getLastNotificationResponseAsync().then(response => {
            if (response) handleNotificationNavigation(response);
        });

        const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
            handleNotificationNavigation(response);
        });

        return () => {
            unsubscribeNotifee();
            responseSub.remove();
        };
    }, [isUpdating, handleNotifeeInteraction, handleNotificationNavigation]);

    if (!fontsLoaded || isUpdating || !appReady || !minLoadDone) {
        return (
            <AnimeLoading
                tipType={"general"}
                message={isUpdating ? "UPDATING_CORE" : "LOADING_PAGE"}
                subMessage={isUpdating ? "Updating system configurations..." : "Fetching Otaku Archives"}
            />
        );
    }
    return (
        <View key={colorScheme} className="flex-1 bg-white dark:bg-gray-900">
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#0a0a0a" : "#ffffff"} />
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: isDark ? "#0a0a0a" : "#ffffff" },
                    animation: 'slide_from_right'
                }}
            />
            <ReviewGate />
            <Toast />
            <IsolatedUploadProgress />
        </View>
    );
}

export default function RootLayout() {
    return (
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <AlertProvider>
                <UserProvider>
                    <ClanProvider>
                        <CoinProvider>
                            <EventProvider>
                                <UploadProgressProvider>
                                    <RootLayoutContent />
                                </UploadProgressProvider>
                            </EventProvider>
                        </CoinProvider>
                    </ClanProvider>
                </UserProvider>
            </AlertProvider>
        </SafeAreaProvider>
    );
}