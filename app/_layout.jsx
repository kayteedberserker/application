import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useFonts } from "expo-font";
import * as Linking from 'expo-linking';
import * as Notifications from "expo-notifications";
import { Stack, usePathname, useRouter } from "expo-router";
import * as Updates from 'expo-updates';
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, BackHandler, DeviceEventEmitter, InteractionManager, Platform, StatusBar, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from 'react-native-toast-message';

import AnimeLoading from "../components/AnimeLoading";
import ReviewGate from "../components/ReviewGate";
import { AlertProvider } from '../context/AlertContext';
import { ClanProvider } from "../context/ClanContext";
import { CoinProvider } from "../context/CoinContext";
import { StreakProvider, useStreak } from "../context/StreakContext";
import { UserProvider, useUser } from "../context/UserContext";
import apiFetch from "../utils/apiFetch";
import "./globals.css";

// 🛑 GLOBAL LOCKS
let IS_NAVIGATING_GLOBAL = false;
let LAST_PROCESSED_NOTIF_ID = null;
let LAST_PROCESSED_URL = null;

// 🔹 NOTIFICATION HANDLER
Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
        const { title, body, data } = notification.request.content;
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

    const [isSyncing, setIsSyncing] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [appReady, setAppReady] = useState(false);

    // Refs to track state inside listeners
    const appReadyRef = useRef(false);

    const pendingNavigation = useRef(null);
    const appState = useRef(AppState.currentState);

    // Sync refs with state
    useEffect(() => { appReadyRef.current = appReady; }, [appReady]);

    useEffect(() => {
        const runCacheJanitor = async () => {
            try {
                const allKeys = await AsyncStorage.getAllKeys();
                const targetPrefixes = ["POSTS_CACHE_", "CATEGORY_CACHE_", "clan_posts_", "WARS_", "CLAN_PROFILE_", "auth_cache_"];
                const expiredTime = 48 * 60 * 60 * 1000;
                const now = Date.now();
                const keysToReview = allKeys.filter(key => targetPrefixes.some(prefix => key.startsWith(prefix)));

                for (const key of keysToReview) {
                    const value = await AsyncStorage.getItem(key);
                    if (!value) continue;
                    try {
                        const parsed = JSON.parse(value);
                        if (parsed && typeof parsed === 'object' && parsed.timestamp) {
                            if (now - parsed.timestamp > expiredTime) {
                                await AsyncStorage.removeItem(key);
                                console.log(`🧹 Janitor: Cleared expired cache: ${key}`);
                            }
                        }
                    } catch (e) {
                        await AsyncStorage.removeItem(key);
                    }
                }
            } catch (err) {
                console.error("Janitor failed:", err);
            }
        };
        const timeout = setTimeout(runCacheJanitor, 30000);
        return () => clearTimeout(timeout);
    }, []);

    const currentPathRef = useRef(pathname);
    useEffect(() => {
        currentPathRef.current = pathname;
    }, [pathname]);

    // 🔹 ROUTING PROCESSOR
    const processRouting = useCallback((data) => {
        console.log("📍 [processRouting] Incoming Data:", JSON.stringify(data));
        if (!data?.notificationId) return;

        const currentNotifId = data.notificationId || data.id || JSON.stringify(data);

        if (IS_NAVIGATING_GLOBAL || LAST_PROCESSED_NOTIF_ID === currentNotifId) {
            return;
        }

        // Ads check removed: now only waits for appReady
        if (!appReadyRef.current) {
            console.log("⏳ [processRouting] App not ready. Queuing request...");
            pendingNavigation.current = data;
            return;
        }

        const targetPostId = data.postId || data.id || data.body?.postId;
        const targetType = data.type || data.body?.type;
        const targetDiscussionId = data.discussion || data.commentId;

        let targetPath = "";
        if (targetType === "open_diary" || targetType === "diary") {
            targetPath = "/authordiary";
        } else if (targetPostId) {
            targetPath = `/post/${targetPostId}`;
        } else if (targetType === "version_update") {
            targetPath = "/";
        }

        if (!targetPath) return;

        const currentPathBase = currentPathRef.current.split('?')[0];
        const targetPathBase = targetPath.split('?')[0];
        const isOnSamePage = currentPathBase === targetPathBase;

        if (isOnSamePage) {
            if (targetDiscussionId) {
                DeviceEventEmitter.emit("openCommentSection", { discussionId: targetDiscussionId });
            }
            return;
        }

        const finalUrl = targetDiscussionId ? `${targetPath}?discussionId=${targetDiscussionId}` : targetPath;

        requestAnimationFrame(() => {
            router.replace(finalUrl);
        });
    }, [router]);

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
    }, []);

    // 🔹 INITIALIZATION (AD-FREE)
    useEffect(() => {
        if (Platform.OS === 'web') {
            setAppReady(true);
            return;
        }

        // We no longer need LevelPlay.init here.
        // Just set the app to ready once this effect runs.
        setAppReady(true);
    }, []);

    // 🔹 FLUSH PENDING NAVIGATION
    useEffect(() => {
        if (appReady && pendingNavigation.current) {
            console.log("🔄 Flushing pending navigation...");
            const data = pendingNavigation.current;
            pendingNavigation.current = null;
            processRouting(data);
        }
    }, [appReady, processRouting]);

    useEffect(() => {
        const handleUrl = (url) => {
            if (!url || isUpdating) return;

            if (url === LAST_PROCESSED_URL) return;

            LAST_PROCESSED_URL = url;
            setTimeout(() => { LAST_PROCESSED_URL = null; }, 3000);

            const parsed = Linking.parse(url);
            const { path, queryParams } = parsed;

            if (path && path !== "/") {
                const segments = path.split('/');
                const pathId = segments.pop();
                const type = segments.includes('post') ? 'post_detail' : null;

                if (path.includes('post/')) {
                    processRouting({ postId: pathId, type: type, ...queryParams });
                } else {
                    const currentPathBase = currentPathRef.current;
                    if (currentPathBase !== `/${path}`) {
                        router.replace(path);
                    }
                }
            }
        };

        const subscription = Linking.addEventListener('url', (event) => handleUrl(event.url));
        return () => subscription.remove();
    }, [isUpdating, processRouting]);

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
    });

    useEffect(() => {
        if (!fontsLoaded || isUpdating) return;

        const task = InteractionManager.runAfterInteractions(async () => {
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
            setIsSyncing(false);
        });

        return () => task.cancel();
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
            if (type === EventType.PRESS) {
                handleNotifeeInteraction(detail);
            }
        });

        notifee.getInitialNotification().then(initialNotification => {
            if (initialNotification) {
                handleNotifeeInteraction(initialNotification);
            }
        });

        Notifications.getLastNotificationResponseAsync().then(response => {
            if (response) {
                handleNotificationNavigation(response);
            }
        });

        const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
            handleNotificationNavigation(response);
        });

        return () => {
            unsubscribeNotifee();
            responseSub.remove();
        };
    }, [isUpdating, handleNotifeeInteraction, handleNotificationNavigation]);

    // --- 🔹 LOADING UI ---
    if (!fontsLoaded || isUpdating || !appReady) {
        return (
            <AnimeLoading
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
        <SafeAreaProvider>
            <UserProvider>
                <StreakProvider>
                    <ClanProvider>
                        <AlertProvider>
                            <CoinProvider>
                                <RootLayoutContent />
                            </CoinProvider>
                        </AlertProvider>
                    </ClanProvider>
                </StreakProvider>
            </UserProvider>
        </SafeAreaProvider>
    );
}