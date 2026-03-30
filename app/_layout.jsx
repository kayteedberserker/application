import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import Constants from 'expo-constants';
import { useFonts } from "expo-font";
import * as Linking from 'expo-linking';
import * as Notifications from "expo-notifications";
import { Stack, usePathname, useRootNavigationState, useRouter } from "expo-router";
import * as Updates from 'expo-updates';
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, DeviceEventEmitter, Platform, StatusBar, View } from "react-native";
import { useMMKV } from 'react-native-mmkv';
import Purchases from 'react-native-purchases';
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import Toast from 'react-native-toast-message';

import AnimeLoading from "../components/AnimeLoading";
import ReviewGate from "../components/ReviewGate";
import { AlertProvider } from '../context/AlertContext';
import { ClanProvider } from "../context/ClanContext";
import { CoinProvider } from "../context/CoinContext";
import { EventProvider } from "../context/EventContext";
import { StreakProvider, useStreak } from "../context/StreakContext";
import { UserProvider, useUser } from "../context/UserContext";
import apiFetch from "../utils/apiFetch";
import "./globals.css";

// 🛑 GLOBAL LOCKS
let IS_NAVIGATING_GLOBAL = false;
let LAST_PROCESSED_NOTIF_ID = null;
let LAST_PROCESSED_URL = null;

// 🔹 REVENUE_CAT KEYS
const REVENUE_CAT_API_KEYS = {
    ios: "goog_your_ios_key_here",
    android: "goog_cypWcXGzLgDujHkFvHTcUoqUNQi"
};

// 🔹 NOTIFICATION HANDLER
Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
        const { data } = notification.request.content;
        const groupId = data?.groupId;

        if (Platform.OS === 'android' && groupId) {
            try {
                return {
                    shouldShowBanner: false,
                    shouldPlaySound: false,
                    shouldSetBadge: false,
                };
            } catch (error) {
                console.error("Notifee Display Error:", error);
            }
        }

        return {
            shouldShowBanner: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
        };
    },
});

async function registerForPushNotificationsAsync() {
    if (Platform.OS === 'web') return null;
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId || "yMNrI6jWuN";
    try {
        const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        return token;
    } catch (e) { return null; }
}

function RootLayoutContent() {
    const { refreshStreak } = useStreak();
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
        const t = setTimeout(() => setMinLoadDone(true), 3000);
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
            console.log("⏳ Navigation not ready. Queueing...");
            pendingNavigation.current = data;
            return;
        }

        const targetPostId = data.postId || data.id || data.body?.postId;
        const targetType = data.type || data.body?.type;
        const targetPage = data.page || data.body?.page;
        const targetDiscussionId = data.discussion || data.commentId;

        let targetPath = "";
        if (targetType === "open_diary" || targetType === "diary") {
            targetPath = "/authordiary";
        } else if (targetPostId) {
            targetPath = `/post/${targetPostId}`;
        } else if (targetType === "version_update") {
            targetPath = "/";
        } else if (targetType === "screen" && targetPage === "clanprofile") {
            targetPath = "/clanprofile";
        }

        if (!targetPath) return;

        const currentPathBase = currentPathRef.current.split('?')[0];
        const targetPathBase = targetPath.split('?')[0];

        if (currentPathBase === targetPathBase) {
            if (targetDiscussionId) {
                DeviceEventEmitter.emit("openCommentSection", { discussionId: targetDiscussionId });
            }
            return;
        }

        const finalUrl = targetDiscussionId ? `${targetPath}?discussionId=${targetDiscussionId}` : targetPath;

        // ⚡️ Apply Global Lock
        IS_NAVIGATING_GLOBAL = true;
        LAST_PROCESSED_NOTIF_ID = currentNotifId;

        requestAnimationFrame(() => {
            router.replace(finalUrl);
            // Unlock after a delay to allow the router to settle
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

    // 🔹 FLUSH PENDING NAVIGATION (Now waits for isNavigationReady)
    useEffect(() => {
        if (appReady && isNavigationReady && pendingNavigation.current) {
            const data = pendingNavigation.current;
            pendingNavigation.current = null;
            // Short delay to ensure context is fully stable
            const timer = setTimeout(() => processRouting(data), 300);
            return () => clearTimeout(timer);
        }
    }, [appReady, isNavigationReady, processRouting]);

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
                    router.replace(path);
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

    useEffect(() => {
        if (!fontsLoaded || isUpdating) return;
        const setupNotifications = async () => {
            if (Platform.OS === 'android') {
                await notifee.createChannel({
                    id: 'default',
                    name: 'Default Channel',
                    importance: AndroidImportance.HIGH,
                });
            }
            const token = await registerForPushNotificationsAsync();
            if (token && user?.deviceId) {
                apiFetch("https://oreblogda.com/api/users/update-push-token", {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deviceId: user.deviceId, pushToken: token })
                }).catch(() => { });
            }
        };
        setupNotifications();
    }, [fontsLoaded, user?.deviceId, isUpdating]);

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

    // ⚡️ RENDER LOGIC
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
        </View>
    );
}

export default function RootLayout() {
    return (
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <UserProvider>
                <StreakProvider>
                    <ClanProvider>
                        <AlertProvider>
                            <CoinProvider>
                                <EventProvider>
                                    <RootLayoutContent />
                                </EventProvider>
                            </CoinProvider>
                        </AlertProvider>
                    </ClanProvider>
                </StreakProvider>
            </UserProvider>
        </SafeAreaProvider>
    );
}