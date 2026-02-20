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

// 🔹 UNITY LEVELPLAY IMPORTS (Replaced AdMob)
import { LevelPlay, LevelPlayInitRequest, LevelPlayInterstitialAd } from 'unity-levelplay-mediation';

import AnimeLoading from "../components/AnimeLoading";
import ReviewGate from "../components/ReviewGate"; // 👈 Import your new component
import { AlertProvider } from '../context/AlertContext';
import { ClanProvider } from "../context/ClanContext";
import { StreakProvider, useStreak } from "../context/StreakContext";
import { UserProvider, useUser } from "../context/UserContext";
import { AdConfig } from '../utils/AdConfig';
import apiFetch from "../utils/apiFetch";
import "./globals.css";

// 🛑 GLOBAL LOCKS (Defined outside the component to prevent race conditions)
let IS_NAVIGATING_GLOBAL = false;
let LAST_PROCESSED_NOTIF_ID = null;
let LAST_PROCESSED_URL = null;

// 🔹 AD CONFIGURATION
const FIRST_AD_DELAY_MS = 300000;
const COOLDOWN_MS = 300000;

const INTERSTITIAL_ID = String(AdConfig.interstitial || "34wz6l0uzrpi6ce0").trim();

let lastShownTime = Date.now() - (COOLDOWN_MS - FIRST_AD_DELAY_MS);
let interstitialAd = null;
let interstitialLoaded = false;

// 🔹 NOTIFICATION HANDLER
Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
        const { title, body, data } = notification.request.content;
        const groupId = data?.groupId;

        if (Platform.OS === 'android' && groupId) {
            try {
                const channelId = 'default';
                const NOTIFICATION_COLOR = '#FF231F7C';

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

// 🔹 LEVELPLAY INTERSTITIAL LOGIC
const loadInterstitial = () => {
    if (!LevelPlayInterstitialAd) {
        console.warn("LevelPlayInterstitialAd module not found");
        return;
    }

    try {
        if (!interstitialAd) {
            console.log("Creating Interstitial with ID:", INTERSTITIAL_ID);
            interstitialAd = new LevelPlayInterstitialAd(INTERSTITIAL_ID);
        }

        const listener = {
            onAdLoaded: (adInfo) => {
                console.log("✅ Interstitial Loaded:", adInfo);
                interstitialLoaded = true;
            },
            onAdLoadFailed: (error) => {
                console.warn("❌ Interstitial Load Failed:");
                interstitialLoaded = false;
                // Retry logic based on reference
                const retryDelay = error.errorCode === 626 ? 60000 : 30000;
                setTimeout(loadInterstitial, retryDelay);
            },
            onAdClosed: (adInfo) => {
                console.log("Ad closed");
                interstitialLoaded = false;
                lastShownTime = Date.now();
                // Delay reloading the next ad by 15 seconds after close to save resources
                setTimeout(loadInterstitial, 15000);
            },
            onAdDisplayed: (adInfo) => console.log("Ad Displayed:"),
            onAdDisplayFailed: (error, adInfo) => {
                console.warn("Display Failed:", error, adInfo);
                setTimeout(loadInterstitial, 15000);
            },
            onAdClicked: (adInfo) => console.log("User clicked the ad")
        };

        interstitialAd.setListener(listener);
        interstitialAd.loadAd();
    } catch (err) {
        console.warn("Error in loadInterstitial:", err);
    }
};

// 🔹 OPTIMIZED: Helper to show ads without freezing UI (Adapted for LevelPlay)
const tryShowingInterstitial = () => {
    const now = Date.now();
    if (interstitialAd && interstitialAd.isAdReady() && (now - lastShownTime > COOLDOWN_MS)) {
        requestAnimationFrame(() => {
            if (interstitialAd) interstitialAd.showAd();
        });
    }
};

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
    const [isAdReady, setIsAdReady] = useState(false);

    // Refs to track state inside listeners
    const appReadyRef = useRef(false);
    const isAdReadyRef = useRef(false);

    const pendingNavigation = useRef(null);
    const appState = useRef(AppState.currentState);

    // Sync refs with state
    useEffect(() => { appReadyRef.current = appReady; }, [appReady]);
    useEffect(() => { isAdReadyRef.current = isAdReady; }, [isAdReady]);

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
        // 🔹 DELAY JANITOR: Moved from 5 seconds to 30 seconds so it doesn't freeze the app on startup
        const timeout = setTimeout(runCacheJanitor, 30000);
        return () => clearTimeout(timeout);
    }, []);

    const currentPathRef = useRef(pathname);
    useEffect(() => {
        currentPathRef.current = pathname;
    }, [pathname]);

    // 🔹 ROUTING PROCESSOR (REPAIRED)
    const processRouting = useCallback((data) => {
        // 1. Log immediately so we know the function was called
        console.log("📍 [processRouting] Incoming Data:", JSON.stringify(data));
        if (!data?.notificationId) return;
        // 2. Identify the unique notification ID to prevent double-firing
        const currentNotifId = data.notificationId || data.id || JSON.stringify(data);
        // 3. Check Global Locks
        if (IS_NAVIGATING_GLOBAL || LAST_PROCESSED_NOTIF_ID === currentNotifId) {
            console.log("🚫 [processRouting] Blocked: Navigation in progress or Duplicate ID detected.");
            return;
        }
        // 4. Check Readiness (Queue if not ready)
        if (!isAdReadyRef.current || !appReadyRef.current) {
            console.log("⏳ [processRouting] App/Ads not ready. Queuing request...");
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

        if (!targetPath) {
            console.log("⚠️ [processRouting] No target path resolved.");
            return;
        }

        const currentPathBase = currentPathRef.current.split('?')[0];
        const targetPathBase = targetPath.split('?')[0];
        const isOnSamePage = currentPathBase === targetPathBase;

        if (isOnSamePage) {
            console.log("📍 [processRouting] Already on target page. Emitting event.");
            if (targetDiscussionId) {
                DeviceEventEmitter.emit("openCommentSection", { discussionId: targetDiscussionId });
            }
            return;
        }

        const finalUrl = targetDiscussionId ? `${targetPath}?discussionId=${targetDiscussionId}` : targetPath;

        requestAnimationFrame(() => {
            console.log("🏃 [processRouting] Pushing router to:", finalUrl);
            router.replace(finalUrl);
        });
    }, [router]);

    useEffect(() => {
        const navSub = DeviceEventEmitter.addListener("navigateSafely", (targetPath) => {
            if (currentPathRef.current === targetPath) return;
            router.push(targetPath);
        });

        const interstitialListener = DeviceEventEmitter.addListener("tryShowInterstitial", () => {
            InteractionManager.runAfterInteractions(() => {
                tryShowingInterstitial();
            });
        });

        const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
            const currentPath = currentPathRef.current;
            const isAtHome = currentPath === "/" || currentPath === "/(tabs)" || currentPath === "/index";

            if (router.canGoBack()) {
                router.back();
                requestAnimationFrame(() => DeviceEventEmitter.emit("tryShowInterstitial"));
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
            interstitialListener.remove();
            backHandler.remove();
        };
    }, []);

    // --- 🔹 LEVELPLAY INITIALIZATION ---
    useEffect(() => {
        if (Platform.OS === 'web') {
            setIsAdReady(true);
            setAppReady(true);
            return;
        }

        const runMediationInit = async () => {
            try {
                const appKey = '24b53732d';
                const adFormats = ['INTERSTITIAL', 'REWARDED_VIDEO', 'BANNER'];

                const initListener = {
                    onInitSuccess: (config) => {
                        console.log("✅ LevelPlay initialized successfully");
                        setIsAdReady(true);
                        // 🔹 DELAY AD LOAD: Wait 15 seconds before downloading the heavy video ad into memory
                        setTimeout(() => {
                            loadInterstitial();
                        }, 15000);
                    },
                    onInitFailed: (err) => {
                        console.warn("❌ LevelPlay failed to initialize:", err);
                        setIsAdReady(true);
                    }
                };

                if (LevelPlayInitRequest && (LevelPlayInitRequest.builder || LevelPlayInitRequest.Builder)) {
                    const BuilderClass = LevelPlayInitRequest.builder || LevelPlayInitRequest.Builder;
                    const requestBuilder = new BuilderClass(appKey);

                    if (requestBuilder.withAdFormats) {
                        requestBuilder.withAdFormats(adFormats);
                    } else if (requestBuilder.withLegacyAdFormats) {
                        requestBuilder.withLegacyAdFormats(adFormats);
                    }

                    const initRequest = requestBuilder.build();
                    LevelPlay.init(initRequest, initListener);
                } else {
                    LevelPlay.init({ appKey, adFormats }, initListener);
                }
            } catch (e) {
                console.warn("Fatal Init Error caught:", e);
                setIsAdReady(true);
            } finally {
                setAppReady(true);
            }
        };

        runMediationInit();
    }, []);

    // 🔹 FLUSH PENDING NAVIGATION
    useEffect(() => {
        if (isAdReady && appReady && pendingNavigation.current) {
            console.log("🔄 Flushing pending navigation...");
            const data = pendingNavigation.current;
            pendingNavigation.current = null;
            processRouting(data);
        }
    }, [isAdReady, appReady, processRouting]);

    useEffect(() => {
        const handleUrl = (url) => {
            if (!url || isUpdating) return;

            // 🔹 URL DEDUPLICATION
            if (url === LAST_PROCESSED_URL) {
                console.log("🚫 [Linking] Ignoring duplicate URL event");
                return;
            }

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
                    } else {
                        console.log("Already on same page");
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

    // 🔹 NOTIFICATION LISTENER HELPERS
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

    // 🔹 MASTER NOTIFICATION LISTENER SETUP
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

    // --- LOADING UI ---
    if (!fontsLoaded || isUpdating || !isAdReady) {
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
            />{/* It sits here quietly, listening for the event */}
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
                        <RootLayoutContent />
                            </AlertProvider>
                    </ClanProvider>
                </StreakProvider>
            </UserProvider>
        </SafeAreaProvider>
    );
}
