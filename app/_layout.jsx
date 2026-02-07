import Constants from 'expo-constants';
import { useFonts } from "expo-font";
import * as Linking from 'expo-linking';
import * as Notifications from "expo-notifications";
import { Stack, usePathname, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from 'expo-updates';
import { useColorScheme } from "nativewind";
import { useEffect, useRef, useState } from "react";
import { AppState, BackHandler, DeviceEventEmitter, Platform, StatusBar, StyleSheet, View } from "react-native";
import mobileAds, { AdEventType, InterstitialAd, MaxAdContentRating } from 'react-native-google-mobile-ads';
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from 'react-native-toast-message';

import AnimeLoading from "../components/AnimeLoading";
import { loadAppOpenAd, showAppOpenAd } from "../components/appOpenAd";
import { ClanProvider } from "../context/ClanContext";
import { StreakProvider, useStreak } from "../context/StreakContext";
import { UserProvider, useUser } from "../context/UserContext";
import { AdConfig } from '../utils/AdConfig';
import apiFetch from "../utils/apiFetch";
import "./globals.css";

SplashScreen.preventAutoHideAsync();

// 🔹 AD CONFIGURATION
const FIRST_AD_DELAY_MS = 120000; 
const COOLDOWN_MS = 180000;      

const INTERSTITIAL_ID = AdConfig.interstitial;

let lastShownTime = Date.now() - (COOLDOWN_MS - FIRST_AD_DELAY_MS);
let interstitial = null;
let interstitialLoaded = false;

// 🔹 NOTIFICATION HANDLER
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
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
        console.log("✅ Interstitial Loaded");
    });

    ad.addAdEventListener(AdEventType.CLOSED, () => {
        interstitialLoaded = false;
        interstitial = null;
        lastShownTime = Date.now(); 
        loadInterstitial(); 
    });

    ad.addAdEventListener(AdEventType.ERROR, (err) => {
        console.log("❌ Interstitial Error: ", err);
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
    
    const appState = useRef(AppState.currentState);
    const lastHandledNotificationId = useRef(null); 
    const hasHandledRedirect = useRef(false);
    const hasShownWelcomeAd = useRef(false);

    // 🔹 FIX: Ref to track the current pathname without re-triggering listeners
    const currentPathRef = useRef(pathname);
    useEffect(() => {
        currentPathRef.current = pathname;
    }, [pathname]);

    // --- 1. GLOBAL NAVIGATION & BACK HANDLER ---
    useEffect(() => {
        // Safe Navigation Listener
        const navSub = DeviceEventEmitter.addListener("navigateSafely", (targetPath) => {
            if (currentPathRef.current === targetPath) {
                console.log("Blocked redundant navigation to:", targetPath);
                return;
            }
            router.push(targetPath);
        });

        // Ad Listener
        const interstitialListener = DeviceEventEmitter.addListener("tryShowInterstitial", () => {
            const now = Date.now();
            if (interstitialLoaded && interstitial && (now - lastShownTime > COOLDOWN_MS)) {
                interstitial.show();
            }
        });

        // App State Listener
        const stateSub = AppState.addEventListener('change', nextState => {
            if (appState.current.match(/inactive|background/) && nextState === 'active') {
                showAppOpenAd();
            }
            appState.current = nextState;
        });

        // Global Back Button Handler
        const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
            if (router.canGoBack()) {
                DeviceEventEmitter.emit("tryShowInterstitial");
                router.back();
                return true; 
            }
            
            // If on home, exit. Otherwise, go home.
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
    }, []); // Empty array means this runs ONCE on mount. No more loops.

    // --- 2. AD INITIALIZATION ---
    useEffect(() => {
        if (Platform.OS === 'web') {
            setIsAdReady(true);
            return;
        }

        const runMediationInit = async () => {
            try {
                await new Promise(resolve => setTimeout(resolve, 3000));
                await mobileAds().setRequestConfiguration({ maxAdContentRating: MaxAdContentRating.G });
                await mobileAds().initialize();
                loadAppOpenAd();
                loadInterstitial();
                setIsAdReady(true);
            } catch (e) {
                console.error("Ad Engine Init Failure:", e);
                setIsAdReady(true);
            }
        };
        runMediationInit();
    }, []);

    // --- 3. WELCOME AD ---
    useEffect(() => {
        if (appReady && isAdReady && !hasShownWelcomeAd.current) {
            const adShown = showAppOpenAd();
            if (adShown) {
                hasShownWelcomeAd.current = true;
            } else {
                const retryTimeout = setTimeout(() => {
                    if (showAppOpenAd()) hasShownWelcomeAd.current = true;
                }, 2000);
                return () => clearTimeout(retryTimeout);
            }
        }
    }, [appReady, isAdReady]); 

    // --- 4. DEEP LINKING ---
    const url = Linking.useURL(); 
    useEffect(() => {
        if (url && !isSyncing && !isUpdating && !hasHandledRedirect.current) {
            const { path } = Linking.parse(url);
            if (path && path !== "/") {
                const targetPath = path.startsWith('/') ? path : `/${path}`;
                hasHandledRedirect.current = true;
                setTimeout(() => router.replace(targetPath), 500);
            }
        }
    }, [url, isSyncing, isUpdating]);

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

    useEffect(() => { refreshStreak(); }, [pathname, refreshStreak]);

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

        const content = response?.notification?.request?.content;
        const data = content?.data || {};
        const targetPostId = data?.postId || data?.body?.postId || data?.id;
        const targetType = data?.type || data?.body?.type;

        if (targetPostId) {
            hasHandledRedirect.current = true;
            router.push(`/post/${targetPostId}`);
        } else if (targetType === "open_diary" || targetType === "diary") {
            hasHandledRedirect.current = true;
            router.push("/authordiary");
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
    }, [isSyncing, isUpdating]);

    useEffect(() => { if (appReady || fontError) SplashScreen.hideAsync(); }, [appReady, fontError]);

    if (!fontsLoaded || isSyncing || isUpdating || !isAdReady) {
        return (
            <AnimeLoading 
                message={isUpdating ? "UPDATING_CORE" : "LOADING_PAGE"} 
                subMessage={isUpdating ? "Updating system configurations..." : "Syncing Account"} 
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
            
            {/* {__DEV__ && (
                <TouchableOpacity 
                    onPress={() => mobileAds().openDebugMenu(INTERSTITIAL_ID)}
                    style={styles.debugButton}
                >
                    <Text style={styles.debugText}>Ad Inspector</Text>
                </TouchableOpacity>
            )} */}
            <Toast />
        </View>
    );
}

const styles = StyleSheet.create({
  debugButton: { 
    position: 'absolute', bottom: 100, right: 20, backgroundColor: '#E6F4FE', 
    paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#2196F3', elevation: 5, zIndex: 999
  },
  debugText: { color: '#2196F3', fontSize: 12, fontWeight: 'bold' }
});

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