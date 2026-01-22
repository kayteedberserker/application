import Constants from 'expo-constants';
import { useFonts } from "expo-font";
import * as Linking from 'expo-linking'; 
import * as Notifications from "expo-notifications";
import { Stack, usePathname, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from 'expo-updates'; 
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { useColorScheme } from "nativewind";
import { useEffect, useRef, useState } from "react";
import { AppState, BackHandler, DeviceEventEmitter, Platform, StatusBar, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from 'react-native-toast-message';
import { InterstitialAd, AdEventType, TestIds, MobileAds } from 'react-native-google-mobile-ads';
import { Audio } from 'expo-av'; // 🔹 Added for sound

import AnimeLoading from "../components/AnimeLoading";
import apiFetch from "../utils/apiFetch"
import { loadAppOpenAd, showAppOpenAd } from "../components/appOpenAd";
import { StreakProvider, useStreak } from "../context/StreakContext";
import { UserProvider, useUser } from "../context/UserContext";
import { AdConfig } from '../utils/AdConfig';
import "./globals.css";

SplashScreen.preventAutoHideAsync();

// 🔹 AD CONFIGURATION
const FIRST_AD_DELAY_MS = 30000; 
const COOLDOWN_MS = 180000;      
const ADMIN_DEVICE_ID = "4bfe2b53-7591-462f-927e-68eedd7a6447"; 
const ADMIN_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3'; // Futuristic Ping

const INTERSTITIAL_ID = __DEV__ ? TestIds.INTERSTITIAL : AdConfig.interstitial;

let lastShownTime = Date.now() - (COOLDOWN_MS - FIRST_AD_DELAY_MS);
let interstitial = null;
let interstitialLoaded = false;

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
    });

    ad.addAdEventListener(AdEventType.CLOSED, () => {
        interstitialLoaded = false;
        interstitial = null;
        lastShownTime = Date.now(); 
        // 🔹 Notify the app that the cooldown timer has started
        DeviceEventEmitter.emit("adClosedTimerStart");
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
    const [appReady, setAppReady] = useState(false); // 🔹 Defined missing appReady state
    
    const appState = useRef(AppState.currentState);
    const lastProcessedNotificationId = useRef(null);
    const hasHandledRedirect = useRef(false);
    const soundTimer = useRef(null);
    const hasShownWelcomeAd = useRef(false); // 🔹 Track if we've shown the initial ad

    // 🔹 Derived Admin Status
    const isAdmin = user?.deviceId === ADMIN_DEVICE_ID;

    // 🔹 Admin Sound Player
    const playAdminSound = async () => {
        try {
            const { sound } = await Audio.Sound.createAsync({ uri: ADMIN_SOUND_URL });
            await sound.playAsync();
            // Automatically unload sound from memory when finished
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.didJustFinish) sound.unloadAsync();
            });
        } catch (e) { console.log("Sound error:", e); }
    };

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

        // 🔹 Toast Trigger on Navigation/Back
        const interstitialListener = DeviceEventEmitter.addListener("tryShowInterstitial", () => {
            const now = Date.now();
            const timeSinceLast = now - lastShownTime;
            const remaining = Math.max(0, Math.ceil((COOLDOWN_MS - timeSinceLast) / 1000));

            if (isAdmin) {
                if (remaining > 0) {
                    Toast.show({
                        type: 'info',
                        text1: 'Ad Cooldown',
                        text2: `Available in ${remaining}s`,
                        position: 'bottom',
                        visibilityTime: 1500,
                    });
                } else if (!interstitialLoaded) {
                    Toast.show({ type: 'error', text1: 'Ready but Not Loaded', text2: 'Waiting for AdMob fill...' });
                }
            }

            if (interstitialLoaded && interstitial && timeSinceLast > COOLDOWN_MS) {
                interstitial.show();
            }
        });

        // 🔹 Sound Trigger Logic: Set a timer when an ad closes
        const timerListener = DeviceEventEmitter.addListener("adClosedTimerStart", () => {
            if (!isAdmin) return;
            
            if (soundTimer.current) clearTimeout(soundTimer.current);
            
            // Set timer to play sound exactly when cooldown ends
            soundTimer.current = setTimeout(() => {
                playAdminSound();
                Toast.show({ type: 'success', text1: 'Ad System Ready', text2: 'Interstitial is now available.' });
            }, COOLDOWN_MS);
        });

        // Handle initial load delay sound
        if (isAdmin) {
            const initialRemaining = COOLDOWN_MS - (Date.now() - lastShownTime);
            if (initialRemaining > 0) {
                soundTimer.current = setTimeout(playAdminSound, initialRemaining);
            }
        }

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
            timerListener.remove();
            backHandler.remove();
            if (soundTimer.current) clearTimeout(soundTimer.current);
        };
    }, [isAdmin, router]);

    // --- 2. ONE-TIME WELCOME AD LOGIC ---
    useEffect(() => {
        // We wait for appReady (which means fonts and sync are done)
        if (appReady && !hasShownWelcomeAd.current) {
            
            // Try to show the ad
            const adShown = showAppOpenAd();

            if (adShown) {
                hasShownWelcomeAd.current = true; // Mark as shown so it never fires again
                if (__DEV__) console.log("Welcome Ad Displayed");
            } else {
                // If ad wasn't loaded yet, we can try again in 2 seconds 
                const retryTimeout = setTimeout(() => {
                    const retryShown = showAppOpenAd();
                    if (retryShown) {
                        hasShownWelcomeAd.current = true;
                    }
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
            if (path && path !== "/") {
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
            // 🔹 Triggers appReady to true after sync is complete
            setAppReady(true);
            setTimeout(() => setIsSyncing(false), 1500);
        }
        performSync();
    }, [fontsLoaded, user?.deviceId, isUpdating]);

    // --- 6. NOTIFICATIONS ---
    useEffect(() => {
        if (isSyncing || isUpdating) return;
        const handleNotificationResponse = async (response) => {
            const notificationId = response?.notification?.request?.identifier;
            if (!notificationId) return;
            const alreadyHandledId = await AsyncStorage.getItem('last_handled_notification_id');
            if (alreadyHandledId === notificationId || lastProcessedNotificationId.current === notificationId) return;
            lastProcessedNotificationId.current = notificationId;
            await AsyncStorage.setItem('last_handled_notification_id', notificationId);
            const data = response?.notification?.request?.content?.data;
            if (!data) return;
            const targetId = data?.postId || data?.body?.postId || data?.id;
            const type = data?.type || data?.body?.type;
            if (targetId) {
                hasHandledRedirect.current = true;
                setTimeout(() => { router.push(`/post/${targetId}`); }, 800);
            } else if (type === "open_diary" || type === "diary") {
                hasHandledRedirect.current = true;
                setTimeout(() => router.push("/authordiary"), 800);
            }
        };
        Notifications.getLastNotificationResponseAsync().then(response => {
            if (response && !hasHandledRedirect.current) handleNotificationResponse(response);
        });
        const responseSub = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
        return () => responseSub.remove();
    }, [isSyncing, isUpdating]);

    // 🔹 Uses appReady to hide the splash screen
    useEffect(() => { if (appReady || fontError) SplashScreen.hideAsync(); }, [appReady, fontError]);

    if (!fontsLoaded || isSyncing || isUpdating) {
        return <AnimeLoading message={isUpdating ? "UPDATING_CORE" : "LOADING_PAGE"} subMessage={isUpdating ? "Updating system configurations..." : "Syncing Account"} />;
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
                    <RootLayoutContent />
                </StreakProvider>
            </UserProvider>
        </SafeAreaProvider>
    );
}
