import Constants from 'expo-constants';
import { useFonts } from "expo-font";
import * as Linking from 'expo-linking';
import * as Notifications from "expo-notifications";
import { Stack, usePathname, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from 'expo-updates';
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, BackHandler, DeviceEventEmitter, InteractionManager, Platform, StatusBar, TouchableOpacity, View } from "react-native";
import mobileAds, { AdEventType, InterstitialAd, MaxAdContentRating } from 'react-native-google-mobile-ads';
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from 'react-native-toast-message';
// 🔹 NOTIFEE IMPORT
import notifee, { AndroidGroupAlertBehavior, AndroidImportance, EventType } from '@notifee/react-native';

import AnimeLoading from "../components/AnimeLoading";
import { loadAppOpenAd, showAppOpenAd } from "../components/appOpenAd";
import { ClanProvider } from "../context/ClanContext";
import { StreakProvider, useStreak } from "../context/StreakContext";
import { UserProvider, useUser } from "../context/UserContext";
import { AdConfig } from '../utils/AdConfig';
import apiFetch from "../utils/apiFetch";
import "./globals.css";

// 🔹 AD CONFIGURATION
const FIRST_AD_DELAY_MS = 120000;
const COOLDOWN_MS = 180000;

const INTERSTITIAL_ID = AdConfig.interstitial;

let lastShownTime = Date.now() - (COOLDOWN_MS - FIRST_AD_DELAY_MS);
let interstitial = null;
let interstitialLoaded = false

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

const loadInterstitial = () => {
    if (interstitial) return;
    const ad = InterstitialAd.createForAdRequest(INTERSTITIAL_ID, {
        requestNonPersonalizedAdsOnly: true,
    });
    ad.addAdEventListener(AdEventType.LOADED, () => {
        interstitialLoaded = true;
    });
    ad.addAdEventListener(AdEventType.CLOSED, () => {
        interstitialLoaded = false;
        interstitial = null;
        lastShownTime = Date.now();
        loadInterstitial();
    });
    ad.addAdEventListener(AdEventType.ERROR, (err) => {
        interstitial = null;
        interstitialLoaded = false;
        setTimeout(loadInterstitial, 30000);
    });
    ad.load();
    interstitial = ad;
};

// 🔹 OPTIMIZED: Helper to show ads without freezing UI
const tryShowingInterstitial = () => {
    const now = Date.now();
    if (interstitialLoaded && interstitial && (now - lastShownTime > COOLDOWN_MS)) {
        // Use requestAnimationFrame to ensure the UI transition is already underway/finished
        requestAnimationFrame(() => {
            if (interstitial) interstitial.show();
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
        // Note: Notifee channel creation moved to useEffect for performance
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
    
    // 🔹 FIX: Queue for notifications that arrive before app is ready
    const pendingNavigation = useRef(null);

    const appState = useRef(AppState.currentState);
    const lastHandledNotificationId = useRef(null);
    const hasHandledRedirect = useRef(false);
    const hasShownWelcomeAd = useRef(false);
    useEffect(() => {
    const runCacheJanitor = async () => {
        try {
            const allKeys = await AsyncStorage.getAllKeys();

            // 🎯 TARGET LIST: Categories of cache we manage
            const targetPrefixes = [
                "POSTS_CACHE_",
                "CATEGORY_CACHE_",
                "clan_posts_",
                "WARS_",
                "CLAN_PROFILE_",
                "auth_cache_" 
            ];

            const expiredTime = 48 * 60 * 60 * 1000; // 48 Hours
            const now = Date.now();

            const keysToReview = allKeys.filter(key =>
                targetPrefixes.some(prefix => key.startsWith(prefix))
            );

            // Process in batches or chunks if you have hundreds of keys
            for (const key of keysToReview) {
                const value = await AsyncStorage.getItem(key);
                if (!value) continue;

                try {
                    const parsed = JSON.parse(value);

                    // 🛠️ LOGIC CHECK:
                    // 1. If it has a timestamp, check if it's actually expired.
                    if (parsed && typeof parsed === 'object' && parsed.timestamp) {
                        if (now - parsed.timestamp > expiredTime) {
                            await AsyncStorage.removeItem(key);
                            console.log(`🧹 Janitor: Cleared expired cache: ${key}`);
                        }
                    } 
                    // 2. If it's a "Legacy" or "Raw" cache (no timestamp, like raw points or war arrays)
                    // We only delete these if they are very old or corrupted. 
                    // For now, let's let raw caches live unless they fail to parse.
                    
                } catch (e) {
                    // If JSON.parse fails, the data is corrupted. Wipe it.
                    await AsyncStorage.removeItem(key);
                    console.log(`🧹 Janitor: Cleared corrupted cache: ${key}`);
                }
            }
        } catch (err) {
            console.error("Janitor failed to clean storage:", err);
        }
    };

    // Run the janitor shortly after mount so it doesn't compete with the initial UI render
    const timeout = setTimeout(runCacheJanitor, 5000); 
    return () => clearTimeout(timeout);
}, []);


    const currentPathRef = useRef(pathname);
    useEffect(() => {
        currentPathRef.current = pathname;
    }, [pathname]);

    // --- 🔹 SMART ROUTING ENGINE ---
    const processRouting = useCallback((data) => {
        if (!data) return;

        // 🔹 FIX: If app isn't ready, queue this for later so it doesn't get lost
        if (!isAdReady || !appReady) {
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
        
        // Use requestAnimationFrame for snappy transition
        requestAnimationFrame(() => {
            router.push(finalUrl);
        });
    }, [router, isAdReady, appReady]);

    // --- 1. GLOBAL NAVIGATION & BACK HANDLER (INSTANT) ---
    useEffect(() => {
        const navSub = DeviceEventEmitter.addListener("navigateSafely", (targetPath) => {
            if (currentPathRef.current === targetPath) return;
            // 🚀 Navigation first!
            router.push(targetPath);
            // 🚀 Ad check later
            requestAnimationFrame(() => {
                DeviceEventEmitter.emit("tryShowInterstitial");
            });
        });

        const interstitialListener = DeviceEventEmitter.addListener("tryShowInterstitial", () => {
            // Only try showing if the user is not actively interacting
            InteractionManager.runAfterInteractions(() => {
                tryShowingInterstitial();
            });
        });

        const stateSub = AppState.addEventListener('change', nextState => {
            if (appState.current.match(/inactive|background/) && nextState === 'active') {
                showAppOpenAd();
            }
            appState.current = nextState;
        });

        const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
            const currentPath = currentPathRef.current;
            const isAtHome = currentPath === "/" || currentPath === "/(tabs)" || currentPath === "/index";

            if (router.canGoBack()) {
                router.back();
                // Check ad after the slide-back animation starts
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
            stateSub.remove();
            backHandler.remove();
        };
    }, []);

    // --- 2. AD INITIALIZATION (Safe & Fast) ---
    useEffect(() => {
        if (Platform.OS === 'web') {
            setIsAdReady(true);
            return;
        }

        const safetyTimer = setTimeout(() => {
            setIsAdReady(true);
        }, 2000);

        const runMediationInit = async () => {
            try {
                await mobileAds().setRequestConfiguration({
                    maxAdContentRating: MaxAdContentRating.G,
                    tagForChildDirectedTreatment: false,
                });
                
                await mobileAds().initialize();
                loadAppOpenAd();
                loadInterstitial();
                
                clearTimeout(safetyTimer);
                setIsAdReady(true);
            } catch (e) {
                setIsAdReady(true);
            }
        };
        runMediationInit();
        return () => clearTimeout(safetyTimer);
    }, []);

    // 🔹 FIX: Process queued navigation
    useEffect(() => {
        if (isAdReady && appReady && pendingNavigation.current) {
            const data = pendingNavigation.current;
            pendingNavigation.current = null;
            processRouting(data);
        }
    }, [isAdReady, appReady, processRouting]);

    // --- 3. WELCOME AD ---
    useEffect(() => {
        if (appReady && isAdReady && !hasShownWelcomeAd.current) {
            if (showAppOpenAd()) {
                hasShownWelcomeAd.current = true;
            }
        }
    }, [appReady, isAdReady]);

    // --- 4. DEEP LINKING ---
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

    // --- 5. EAS UPDATES ---
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

    // --- 6. SYNC (OPTIMIZED) ---
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

    // --- 7. NOTIFICATIONS ---
    const handleNotificationNavigation = (response) => {
        const notificationId = response?.notification?.request?.identifier;
        if (!notificationId || lastHandledNotificationId.current === notificationId) return;
        lastHandledNotificationId.current = notificationId;
        const data = response?.notification?.request?.content?.data || {};
        processRouting(data);
    };

    const handleNotifeeInteraction = async (detail) => {
        const { notification, pressAction } = detail;
        if (pressAction?.id === 'default' && notification?.data) {
            processRouting(notification.data);
        }
    };

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
            if (response && !hasHandledRedirect.current) {
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
    }, [isUpdating]);

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
                    animation: 'slide_from_right' // Force specific animation for speed
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
