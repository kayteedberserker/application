import Constants from 'expo-constants';
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useColorScheme } from "nativewind";
import { useEffect, useState } from "react";
import { ActivityIndicator, DeviceEventEmitter, Platform, Text as RNText, StatusBar, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from 'react-native-toast-message';
import { UserProvider, useUser } from "../context/UserContext";
import "./globals.css";

SplashScreen.preventAutoHideAsync();

// --- AD CONFIGURATION ---
const FIRST_AD_DELAY_MS = 60000; // 1 minute delay after app opens
const COOLDOWN_MS = 90000; // 90 seconds between subsequent ads
const GAME_ID = "6013445";

// We set the lastShownTime to "now minus (cooldown - first delay)" 
let lastShownTime = Date.now() - (COOLDOWN_MS - FIRST_AD_DELAY_MS);
let interstitial = null;

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

function RootLayoutContent() {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";
    const router = useRouter();
    const { user } = useUser();
    const [isSyncing, setIsSyncing] = useState(true);
    const [adLoading, setAdLoading] = useState(false); // New Loading State

    const [fontsLoaded, fontError] = useFonts({
        "SpaceGrotesk": require("../assets/fonts/SpaceGrotesk.ttf"),
        "SpaceGroteskBold": require("../assets/fonts/SpaceGrotesk.ttf"),
    });

    /* --- ORIGINAL ADMOB LOGIC (COMMENTED OUT) ---
    useEffect(() => {
        if (Platform.OS !== 'web') {
            try {
                const { InterstitialAd, AdEventType, TestIds } = require('react-native-google-mobile-ads');
                const mobileAds = require('react-native-google-mobile-ads').default;
                mobileAds().initialize().then(() => {
                    interstitial = InterstitialAd.createForAdRequest(TestIds.INTERSTITIAL);
                    interstitial.load();
                    // ... (rest of your logic)
                });
            } catch (err) { console.log("AdMob error:", err); }
        }
    }, []);
    */

    // 2. Account Sync & Push Token
    useEffect(() => {
        async function performSync() {
            if (!fontsLoaded) return;
            const token = await registerForPushNotificationsAsync();

            if (token && user?.deviceId) {
                try {
                    await fetch("https://oreblogda.com/api/users/update-push-token", {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            deviceId: user.deviceId,
                            pushToken: token
                        })
                    });
                } catch (err) {
                    console.log("Token sync failed:", err);
                }
            }
            setTimeout(() => setIsSyncing(false), 1500);
        }
        performSync();
    }, [fontsLoaded, user?.deviceId]);

    // 3. Notification Interaction
    useEffect(() => {
        const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
            const data = response.notification.request.content.data;
            if (data?.postId) router.push({ pathname: "/post/[id]", params: { id: data.postId } });
            else if (data?.type === "open_diary") router.push("/authordiary");
        });
        return () => responseSub.remove();
    }, []);

    // Splash Screen Control
    useEffect(() => {
        if (fontsLoaded || fontError) {
            SplashScreen.hideAsync();
        }
    }, [fontsLoaded, fontError]);

    // --- LOADING VIEW ---
    if (!fontsLoaded || isSyncing) {
        return (
            <View className="flex-1 bg-white dark:bg-gray-900 justify-center items-center">
                <ActivityIndicator size="large" color="#3b82f6" />
                {fontsLoaded && (
                    <RNText className="mt-4 text-gray-400 animate-pulse font-bold">
                        Synchronizing account...
                    </RNText>
                )}
            </View>
        );
    }

    return (
        <SafeAreaProvider>
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
                        setTimeout(() => {
                            DeviceEventEmitter.emit("tryShowInterstitial");
                        }, 500);
                    }}
                />
                <Toast />
            </View>
        </SafeAreaProvider>
    );
}

export default function RootLayout() {
    return (
        <UserProvider>
            <RootLayoutContent />
        </UserProvider>
    );
}