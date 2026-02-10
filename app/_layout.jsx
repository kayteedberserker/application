import Constants from 'expo-constants';
import { useFonts } from "expo-font";
import * as Linking from 'expo-linking';
import * as Notifications from "expo-notifications";
import { Stack, usePathname, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from 'expo-updates';
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, BackHandler, DeviceEventEmitter, Platform, StatusBar, TouchableOpacity, View } from "react-native";
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

async function registerForPushNotificationsAsync() {
    if (Platform.OS === 'web') return null;
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
        await notifee.createChannel({
            id: 'default',
            name: 'Default Channel',
            importance: AndroidImportance.HIGH,
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
    const [adStatusLog, setAdStatusLog] = useState("Initializing Ad Engine...");
    const [debugTapCount, setDebugTapCount] = useState(0);
    
    // 🔹 FIX: Queue for notifications that arrive before app is ready
    const pendingNavigation = useRef(null);

    const appState = useRef(AppState.currentState);
    const lastHandledNotificationId = useRef(null);
    const hasHandledRedirect = useRef(false);
    const hasShownWelcomeAd = useRef(false);

    const currentPathRef = useRef(pathname);
    useEffect(() => {
        currentPathRef.current = pathname;
    }, [pathname]);

    // --- 🔹 SMART ROUTING ENGINE ---
    const processRouting = useCallback((data) => {
        if (!data) return;

        // 🔹 FIX: If app isn't ready, queue this for later so it doesn't get lost
        if (!isAdReady) {
            console.log("App not ready, queuing navigation:", data);
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

        // 🔹 FIX: Clean check to prevent double navigation
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
        console.log(finalUrl);

        router.push(finalUrl);
    }, [router, isAdReady]);

    // --- 1. GLOBAL NAVIGATION & BACK HANDLER ---
    useEffect(() => {
        const navSub = DeviceEventEmitter.addListener("navigateSafely", (targetPath) => {
            if (currentPathRef.current === targetPath) return;
            router.push(targetPath);
        });

        const interstitialListener = DeviceEventEmitter.addListener("tryShowInterstitial", () => {
            const now = Date.now();
            if (interstitialLoaded && interstitial && (now - lastShownTime > COOLDOWN_MS)) {
                interstitial.show();
            }
        });

        const stateSub = AppState.addEventListener('change', nextState => {
            if (appState.current.match(/inactive|background/) && nextState === 'active') {
                showAppOpenAd();
            }
            appState.current = nextState;
        });

        const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
            if (router.canGoBack()) {
                DeviceEventEmitter.emit("tryShowInterstitial");
                router.back();
                return true;
            }
            if (currentPathRef.current !== "/" && currentPathRef.current !== "/(tabs)") {
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

    // --- 2. AD INITIALIZATION (Updated with Timeout Fix) ---
    useEffect(() => {
        if (Platform.OS === 'web') {
            setIsAdReady(true);
            return;
        }

        // 🔹 FIX: Safety Timeout - If ads fail/hang, load the app anyway after 2.5s
        const safetyTimer = setTimeout(() => {
            console.log("Ad timeout reached, forcing app load");
            setIsAdReady(true);
        }, 2500);

        const runMediationInit = async () => {
            try {
                await mobileAds().setRequestConfiguration({
                    maxAdContentRating: MaxAdContentRating.G,
                    tagForChildDirectedTreatment: false,
                });
                
                const adapterStatuses = await mobileAds().initialize();
                
                if (typeof loadAppOpenAd === 'function') loadAppOpenAd();
                if (typeof loadInterstitial === 'function') loadInterstitial();
                
                // Clear timeout if successful
                clearTimeout(safetyTimer);
                setTimeout(() => setIsAdReady(true), 1000);
            } catch (e) {
                console.error("AdMob Init Error:", e);
                // Safety timer will handle the fallback
            }
        };
        runMediationInit();
        return () => clearTimeout(safetyTimer);
    }, []);

    // 🔹 FIX: Process queued navigation once app is ready
    useEffect(() => {
        if (isAdReady && pendingNavigation.current) {
            const data = pendingNavigation.current;
            pendingNavigation.current = null;
            // Short delay to ensure stack is mounted
            setTimeout(() => processRouting(data), 100);
        }
    }, [isAdReady, processRouting]);

    // --- 3. WELCOME AD ---
    useEffect(() => {
        if (appReady && isAdReady && !hasShownWelcomeAd.current) {
            if (showAppOpenAd()) {
                hasShownWelcomeAd.current = true;
            }
        }
    }, [appReady, isAdReady]);

    // --- 4. DEEP LINKING (Event Based) ---
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
                    processRouting({
                        postId: pathId,
                        type: type,
                        ...queryParams
                    });
                } else {
                    const currentPathBase = currentPathRef.current
                    
                    if (currentPathBase == `/${path}`) {
                        console.log("Youre in the same page not pushing");
                        return
                    }
                    router.push(path)
                }

            }
        };

        // 🔹 FIX: REMOVED `Linking.getInitialURL()` 
        // Expo Router automatically handles the initial URL. 
        // Keeping it here was causing the "Double Page" bug.

        // Listen for new links while app is open (Handles Duplicates perfectly)
        const subscription = Linking.addEventListener('url', (event) => {
            handleUrl(event.url);
        });

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
                    setTimeout(async () => { await Updates.reloadAsync(); }, 1500);
                }
            } catch (error) { setIsUpdating(false); }
        }
        onFetchUpdateAsync();
    }, []);

    const [fontsLoaded, fontError] = useFonts({
        "SpaceGrotesk": require("../assets/fonts/SpaceGrotesk.ttf"),
        "SpaceGroteskBold": require("../assets/fonts/SpaceGrotesk.ttf"),
    });

    
    // --- 6. SYNC ---
    useEffect(() => {
        async function performSync() {
            if (!fontsLoaded || isUpdating) return;
            const token = await registerForPushNotificationsAsync();
            if (token && user?.deviceId) {
                try {
                    await apiFetch("https://oreblogda.com/api/users/update-push-token", {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ deviceId: user.deviceId, pushToken: token })
                    });
                } catch (err) { }
            }
            setAppReady(true);
            setTimeout(() => setIsSyncing(false), 1500);
        }
        performSync();
    }, [fontsLoaded, user?.deviceId, isUpdating]);

    // --- 7. NOTIFICATIONS ---
    const handleNotificationNavigation = (response) => {
        const notificationId = response?.notification?.request?.identifier;
        if (!notificationId || lastHandledNotificationId.current === notificationId) return;
        lastHandledNotificationId.current = notificationId;
        const data = response?.notification?.request?.content?.data || {};
        console.log(data);
        
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

  
    // 🔹 FIX: Only block rendering if fonts/updates are pending.
    // If ads are not ready but timeout passed, isAdReady will be true, allowing app to load.
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
                screenOptions={{ headerShown: false, contentStyle: { backgroundColor: isDark ? "#0a0a0a" : "#ffffff" } }}
                onStateChange={() => {
                    setTimeout(() => { DeviceEventEmitter.emit("tryShowInterstitial"); }, 500);
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
