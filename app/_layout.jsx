import Constants from 'expo-constants';
import { useFonts } from "expo-font";
import * as Linking from 'expo-linking'; 
import * as Notifications from "expo-notifications";
import { Stack, usePathname, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from 'expo-updates'; 
import { useColorScheme } from "nativewind";
import { useEffect, useRef, useState } from "react";
import { AppState, BackHandler, DeviceEventEmitter, Platform, StatusBar, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from 'react-native-toast-message';
import { InterstitialAd, AdEventType, TestIds, MobileAds } from 'react-native-google-mobile-ads';

import AnimeLoading from "../components/AnimeLoading";
import apiFetch from "../utils/apiFetch"
import { loadAppOpenAd, showAppOpenAd } from "../components/appOpenAd";
import { StreakProvider, useStreak } from "../context/StreakContext";
import { UserProvider, useUser } from "../context/UserContext";
import { AdConfig } from '../utils/AdConfig';
import "./globals.css";

SplashScreen.preventAutoHideAsync();

// 🔹 AD CONFIGURATION
const FIRST_AD_DELAY_MS = 90000; 
const COOLDOWN_MS = 120000;      

const INTERSTITIAL_ID = __DEV__ ? TestIds.INTERSTITIAL : AdConfig.interstitial;

let lastShownTime = Date.now() - (COOLDOWN_MS - FIRST_AD_DELAY_MS);
let interstitial = null;
let interstitialLoaded = false;

// 🔹 NOTIFICATION HANDLER (Foreground Behavior)
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        // The 'color' here helps resolve the "white square" by providing the accent color 
        // for the notification content area on Android.
        priority: Notifications.AndroidImportance.MAX,
    }),
});

// 🔹 HELPER: Load Interstitial
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
        loadInterstitial(); // Pre-load the next one immediately
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
            lightColor: '#60a5fa', // Matches your "System" Blue
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
    
    const appState = useRef(AppState.currentState);
    const lastHandledNotificationId = useRef(null); 
    const hasHandledRedirect = useRef(false);
    const hasShownWelcomeAd = useRef(false);

    // --- 1. AD LOGIC ---
    useEffect(() => {
        if (Platform.OS === 'web') return;

        MobileAds().initialize().then(() => {
            loadAppOpenAd();
            loadInterstitial();
        });

        const sub = AppState.addEventListener('change', nextState => {
            if (appState.current.match(/inactive|background/) && nextState === 'active') {
                showAppOpenAd();
            }
            appState.current = nextState;
        });

        const interstitialListener = DeviceEventEmitter.addListener("tryShowInterstitial", () => {
            const now = Date.now();
            const timeSinceLast = now - lastShownTime;
            
            if (interstitialLoaded && interstitial && timeSinceLast > COOLDOWN_MS) {
                interstitial.show();
            }
        });

        const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
            if (router.canGoBack()) {
                DeviceEventEmitter.emit("tryShowInterstitial");
                router.back();
                return true; 
            }
            return false; 
        });

        return () => {
            sub.remove();
            interstitialListener.remove();
            backHandler.remove();
        };
    }, [router]);

    // --- 2. ONE-TIME WELCOME AD LOGIC ---
    useEffect(() => {
        if (appReady && !hasShownWelcomeAd.current) {
            const adShown = showAppOpenAd();
            if (adShown) {
                hasShownWelcomeAd.current = true;
            } else {
                const retryTimeout = setTimeout(() => {
                    const retryShown = showAppOpenAd();
                    if (retryShown) hasShownWelcomeAd.current = true;
                }, 2000);
                return () => clearTimeout(retryTimeout);
            }
        }
    }, [appReady]); 

    // --- 3. DEEP LINKING ---
    const url = Linking.useURL(); 
    useEffect(() => {
        if (url && !isSyncing && !isUpdating && !hasHandledRedirect.current) {
            const { path } = Linking.parse(url);
            if (path && path !== "/" && pathname !== `/${path}`) {
                const targetPath = path.startsWith('/') ? path : `/${path}`;
                hasHandledRedirect.current = true;
                setTimeout(() => router.replace(targetPath), 500);
            }
        }
    }, [url, isSyncing, isUpdating]);

    // --- 4. EAS UPDATES ---
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

    useEffect(() => { refreshStreak(); }, [pathname, refreshStreak]);

    // --- 5. SYNC & PUSH TOKEN ---
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

    // --- 6. NOTIFICATIONS (Enhanced Navigation) ---
    const handleNotificationNavigation = (response) => {
        const notificationId = response?.notification?.request?.identifier;
        if (!notificationId || lastHandledNotificationId.current === notificationId) return;
        lastHandledNotificationId.current = notificationId;

        const content = response?.notification?.request?.content;
        const data = content?.data || {};
        
        const targetPostId = data?.postId || data?.body?.postId || data?.id;
        const targetType = data?.type || data?.body?.type;

        // Check current pathname to avoid duplicate "Stacking"
        if (targetPostId) {
            const targetPath = `/post/${targetPostId}`;
            if (pathname !== targetPath) {
                hasHandledRedirect.current = true;
                router.push(targetPath);
            }
        } else if (targetType === "open_diary" || targetType === "diary") {
            if (pathname !== "/authordiary") {
                hasHandledRedirect.current = true;
                router.push("/authordiary");
            }
        }
    };

    useEffect(() => {
        if (isSyncing || isUpdating) return;

        Notifications.getLastNotificationResponseAsync().then(response => {
            if (response && !hasHandledRedirect.current) {
                handleNotificationNavigation(response);
            }
        });

        const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
            handleNotificationNavigation(response);
        });

        return () => responseSub.remove();
    }, [isSyncing, isUpdating, pathname]); // Added pathname as dependency

    // 🔹 Splash Screen Hiding
    useEffect(() => { if (appReady || fontError) SplashScreen.hideAsync(); }, [appReady, fontError]);

    if (!fontsLoaded || isSyncing || isUpdating) {
        return <AnimeLoading message={isUpdating ? "UPDATING_CORE" : "LOADING_PAGE"} subMessage={isUpdating ? "Updating system configurations..." : "Syncing Account"} />;
    }

    return (
        <View key={colorScheme} className="flex-1 bg-white dark:bg-gray-900">
            <StatusBar 
                barStyle={isDark ? "light-content" : "dark-content"} 
                backgroundColor={isDark ? "#000000" : "#ffffff"} 
                translucent={true}
            />
            <Stack
                screenOptions={{ 
                    headerShown: false, 
                    contentStyle: { backgroundColor: isDark ? "#000000" : "#ffffff" },
                    animation: 'fade_from_bottom' 
                }}
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
                    <RootLayoutContent />
                </StreakProvider>
            </UserProvider>
        </SafeAreaProvider>
    );
}
