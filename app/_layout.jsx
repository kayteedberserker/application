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
import { InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';

import AnimeLoading from "../components/AnimeLoading";
import { loadAppOpenAd, showAppOpenAd } from "../components/appOpenAd";
import { StreakProvider, useStreak } from "../context/StreakContext";
import { UserProvider, useUser } from "../context/UserContext";
import { AdConfig } from '../utils/AdConfig';
import "./globals.css";

SplashScreen.preventAutoHideAsync();

// 🔹 AD CONFIGURATION
const FIRST_AD_DELAY_MS = 30000; // First ad comes after 30 seconds
const COOLDOWN_MS = 180000;      // Subsequent ads every 3 minutes

// Use Test ID in Dev, Real ID in Prod
const INTERSTITIAL_ID = __DEV__
    ? TestIds.INTERSTITIAL 
    : AdConfig.interstitial;

// Logic: We set 'Last' to effectively be "150,000ms ago" so that in 30s the diff is 180,000.
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
    } catch (e) {
        console.error("Push Token Error:", e);
        return null;
    }
}

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
        loadInterstitial(); 
    });

    ad.load();
    interstitial = ad;
};

function RootLayoutContent() {
    const { refreshStreak } = useStreak();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";
    const router = useRouter();
    const pathname = usePathname();
    const { user } = useUser();
    
    const [isSyncing, setIsSyncing] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false); 
    
    const appState = useRef(AppState.currentState);
    const lastProcessedNotificationId = useRef(null);
    const hasHandledRedirect = useRef(false);

    // --- 1. DEEP LINKING HANDLER ---
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

    // --- 2. EAS UPDATE GUARDIAN ---
    useEffect(() => {
        async function onFetchUpdateAsync() {
            if (__DEV__) return; 
            try {
                const update = await Updates.checkForUpdateAsync();
                if (update.isAvailable) {
                    setIsUpdating(true); 
                    await Updates.fetchUpdateAsync();
                    setTimeout(async () => {
                        await Updates.reloadAsync();
                    }, 1500);
                }
            } catch (error) {
                console.log("EAS Sync Error:", error);
                setIsUpdating(false);
            }
        }
        onFetchUpdateAsync();
    }, []);

    const [fontsLoaded, fontError] = useFonts({
        "SpaceGrotesk": require("../assets/fonts/SpaceGrotesk.ttf"),
        "SpaceGroteskBold": require("../assets/fonts/SpaceGrotesk.ttf"),
    });

    // --- 3. AD LOGIC (Including Back Button) ---
    useEffect(() => {
        if (Platform.OS === 'web') return;

        loadAppOpenAd();
        loadInterstitial();

        const sub = AppState.addEventListener('change', nextState => {
            if (appState.current.match(/inactive|background/) && nextState === 'active') {
                showAppOpenAd();
            }
            appState.current = nextState;
        });

        // 🔹 Listen for the "tryShowInterstitial" event
        const interstitialListener = DeviceEventEmitter.addListener("tryShowInterstitial", () => {
            const now = Date.now();
            const timeSinceLast = now - lastShownTime;

            if (interstitialLoaded && interstitial && timeSinceLast > COOLDOWN_MS) {
                interstitial.show();
            }
        });

        // 🔹 TRIGGER ON ANDROID BACK BUTTON
        const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
            // When back is pressed, we emit the event to check if an ad should show
            DeviceEventEmitter.emit("tryShowInterstitial");
            
            // Return false so the back button still performs the actual navigation
            return false; 
        });

        return () => {
            sub.remove();
            interstitialListener.remove();
            backHandler.remove();
        };
    }, []);

    useEffect(() => {
        refreshStreak();
    }, [pathname, refreshStreak]);

    // --- 4. Account Sync & Push Token ---
    useEffect(() => {
        async function performSync() {
            if (!fontsLoaded || isUpdating) return; 
            const token = await registerForPushNotificationsAsync();
            if (token && user?.deviceId) {
                try {
                    await fetch("https://oreblogda.com/api/users/update-push-token", {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ deviceId: user.deviceId, pushToken: token })
                    });
                } catch (err) {
                    console.log("Token sync failed:", err);
                }
            }
            setTimeout(() => setIsSyncing(false), 1500);
        }
        performSync();
    }, [fontsLoaded, user?.deviceId, isUpdating]);

    // --- 5. NOTIFICATION INTERACTION ---
    useEffect(() => {
        if (isSyncing || isUpdating) return;

        const handleNotificationResponse = async (response) => {
            const notificationId = response?.notification?.request?.identifier;
            if (!notificationId) return;

            const alreadyHandledId = await AsyncStorage.getItem('last_handled_notification_id');
            if (alreadyHandledId === notificationId || lastProcessedNotificationId.current === notificationId) {
                return;
            }

            lastProcessedNotificationId.current = notificationId;
            await AsyncStorage.setItem('last_handled_notification_id', notificationId);

            const data = response?.notification?.request?.content?.data;
            if (!data) return;

            const targetId = data?.postId || data?.body?.postId || data?.id;
            const type = data?.type || data?.body?.type;

            if (targetId) {
                hasHandledRedirect.current = true;
                setTimeout(() => {
                    router.push(`/post/${targetId}`);
                }, 800);
            } 
            else if (type === "open_diary" || type === "diary") {
                hasHandledRedirect.current = true;
                setTimeout(() => router.push("/authordiary"), 800);
            }
        };

        Notifications.getLastNotificationResponseAsync().then(response => {
            if (response && !hasHandledRedirect.current) {
                handleNotificationResponse(response);
            }
        });

        const responseSub = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
        return () => responseSub.remove();
    }, [isSyncing, isUpdating]);

    useEffect(() => {
        if (fontsLoaded || fontError) {
            SplashScreen.hideAsync();
        }
    }, [fontsLoaded, fontError]);

    if (!fontsLoaded || isSyncing || isUpdating) {
        return (
            <AnimeLoading 
                message={isUpdating ? "CORE_SYNC" : "LOADING_PAGE"} 
                subMessage={isUpdating ? "Optimizing system transmissions..." : "Syncing Account"} 
            />
        );
    }

    return (
        <View key={colorScheme} className="flex-1 bg-white dark:bg-gray-900">
            <StatusBar
                barStyle={isDark ? "light-content" : "dark-content"}
                backgroundColor={isDark ? "#0a0a0a" : "#ffffff"}
            />
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: isDark ? "#0a0a0a" : "#ffffff" },
                }}
                onStateChange={() => {
                    // This covers screen changes NOT triggered by the back button
                    setTimeout(() => {
                        DeviceEventEmitter.emit("tryShowInterstitial");
                    }, 500);
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
