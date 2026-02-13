import notifee, { AndroidGroupAlertBehavior, AndroidImportance, EventType } from '@notifee/react-native';
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
import { ClanProvider } from "../context/ClanContext";
import { StreakProvider, useStreak } from "../context/StreakContext";
import { UserProvider, useUser } from "../context/UserContext";
import { AdConfig } from '../utils/AdConfig';
import apiFetch from "../utils/apiFetch";
import "./globals.css";

// 🔹 AD CONFIGURATION
const FIRST_AD_DELAY_MS = 120000;
const COOLDOWN_MS = 360000;

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

                await notifee.displayNotification({
                    id: groupId,
                    title: "Recent Votes",
                    subtitle: 'Activity',
                    android: {
                        channelId,
                        groupKey: groupId,
                        groupSummary: true,
                        groupAlertBehavior: AndroidGroupAlertBehavior.CHILDREN,
                        pressAction: { id: 'default' },
                        smallIcon: 'ic_notification',
                        color: NOTIFICATION_COLOR,
                    },
                });

                await notifee.displayNotification({
                    title: title,
                    body: body,
                    data: data,
                    android: {
                        channelId,
                        groupKey: groupId,
                        groupSummary: false,
                        groupAlertBehavior: AndroidGroupAlertBehavior.CHILDREN,
                        pressAction: { id: 'default' },
                        smallIcon: 'ic_notification',
                        color: NOTIFICATION_COLOR,
                    },
                });

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
                console.log("✅ Interstitial Loaded:", adInfo?.adNetwork);
                interstitialLoaded = true;
            },
            onAdLoadFailed: (error) => {
                console.error("❌ Interstitial Load Failed:", error);
                interstitialLoaded = false;
                // Retry logic based on reference
                const retryDelay = error.errorCode === 626 ? 60000 : 30000;
                setTimeout(loadInterstitial, retryDelay);
            },
            onAdClosed: (adInfo) => {
                console.log("Ad closed");
                interstitialLoaded = false;
                lastShownTime = Date.now();
                loadInterstitial();
            },
            onAdDisplayed: (adInfo) => console.log("Ad Displayed"),
            onAdDisplayFailed: (error, adInfo) => {
                console.error("Display Failed:", error, adInfo);
                loadInterstitial();
            },
            onAdClicked: (adInfo) => console.log("User clicked the ad")
        };

        interstitialAd.setListener(listener);
        interstitialAd.loadAd();
    } catch (err) {
        console.error("Error in loadInterstitial:", err);
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
    const lastHandledNotificationId = useRef(null);
    const hasHandledRedirect = useRef(false);
    const hasShownWelcomeAd = useRef(false);

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
        const timeout = setTimeout(runCacheJanitor, 5000); 
        return () => clearTimeout(timeout);
    }, []);

    const currentPathRef = useRef(pathname);
    useEffect(() => {
        currentPathRef.current = pathname;
    }, [pathname]);

    // 🔹 ROUTING PROCESSOR
    const processRouting = useCallback((data) => {
        if (!data) return;
        
        // Use Refs for checking readiness to avoid stale closures in listeners
        if (!isAdReadyRef.current || !appReadyRef.current) {
            console.log("⏳ App not ready for routing, queuing...", data);
            pendingNavigation.current = data;
            return;
        }

        console.log("🚀 Processing Notification Route:", data);

        const targetPostId = data.postId || data.id || data.body?.postId;
        const targetType = data.type || data.body?.type;
        const targetDiscussionId = data.discussion || data.commentId;

        let targetPath = "";
        if (targetType === "open_diary" || targetType === "diary") {
            targetPath = "/authordiary";
        } else if (targetPostId) {
            targetPath = `/post/${targetPostId}`;
        } else if(targetType === "version_update") {
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

        hasHandledRedirect.current = true;
        const finalUrl = targetDiscussionId ? `${targetPath}?discussionId=${targetDiscussionId}` : targetPath;
        
        requestAnimationFrame(() => {
            router.push(finalUrl);
        });
    }, [router]); // Dependencies reduced, logic relies on Refs for stability

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
                        loadInterstitial();
                    },
                    onInitFailed: (err) => {
                        console.error("❌ LevelPlay failed to initialize:", err);
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
                console.error("Fatal Init Error caught:", e);
                setIsAdReady(true);
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
            const parsed = Linking.parse(url);
            const { path, queryParams } = parsed;

            if (path && path !== "/") {
                const segments = path.split('/');
                const pathId = segments.pop();
                const type = segments.includes('post') ? 'post_detail' : null;
                
                if (path.includes('/post/')) {
                    processRouting({ postId: pathId, type: type, ...queryParams });
                } else {
                    const currentPathBase = currentPathRef.current;
                    if (currentPathBase !== `/${path}`) {
                        router.push(path);
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
                }).catch(() => {});
            }
            setAppReady(true);
            setIsSyncing(false);
        });

        return () => task.cancel();
    }, [fontsLoaded, user?.deviceId, isUpdating]);

    // 🔹 NOTIFICATION LISTENER HELPERS
    const handleNotificationNavigation = useCallback((response) => {
        const notificationId = response?.notification?.request?.identifier;
        if (!notificationId || lastHandledNotificationId.current === notificationId) return;
        lastHandledNotificationId.current = notificationId;
        const data = response?.notification?.request?.content?.data || {};
        processRouting(data);
    }, [processRouting]);

    const handleNotifeeInteraction = useCallback(async (detail) => {
        const { notification, pressAction } = detail;
        if (pressAction?.id === 'default' && notification?.data) {
            processRouting(notification.data);
        }
    }, [processRouting]);

    // 🔹 MASTER NOTIFICATION LISTENER SETUP
    useEffect(() => {
        if (isUpdating) return;

        // 1. Notifee Foreground/Background Interaction
        const unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
            if (type === EventType.PRESS) {
                handleNotifeeInteraction(detail);
            }
        });

        // 2. Notifee Initial Notification (Quit State)
        notifee.getInitialNotification().then(initialNotification => {
            if (initialNotification) {
                handleNotifeeInteraction(initialNotification);
            }
        });

        // 3. Expo Last Response (Quit State)
        Notifications.getLastNotificationResponseAsync().then(response => {
            if (response && !hasHandledRedirect.current) {
                handleNotificationNavigation(response);
            }
        });

        // 4. Expo Interaction Listener
        const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
            handleNotificationNavigation(response);
        });

        return () => {
            unsubscribeNotifee();
            responseSub.remove();
        };
    }, [isUpdating, handleNotifeeInteraction, handleNotificationNavigation]); // Added dependencies to refresh listeners

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
            />
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
                        <RootLayoutContent />
                    </ClanProvider>
                </StreakProvider>
            </UserProvider>
        </SafeAreaProvider>
    );
}
