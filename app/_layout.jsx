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
import { AppState, BackHandler, DeviceEventEmitter, Platform, StatusBar, View, Text, TouchableOpacity, Modal, TextInput } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from 'react-native-toast-message';
import { InterstitialAd, AdEventType, TestIds, MobileAds } from 'react-native-google-mobile-ads';

import AnimeLoading from "../components/AnimeLoading";
import { loadAppOpenAd, showAppOpenAd } from "../components/appOpenAd";
import { StreakProvider, useStreak } from "../context/StreakContext";
import { UserProvider, useUser } from "../context/UserContext";
import { AdConfig } from '../utils/AdConfig';
import "./globals.css";

SplashScreen.preventAutoHideAsync();

// 🔹 AD CONFIGURATION
const FIRST_AD_DELAY_MS = 30000; 
const COOLDOWN_MS = 180000;      
const SECRET_PIN = "1807";
const ADMIN_ENABLED_KEY = "@admin_cooldown_toast_enabled";
const ADMIN_BANNED_KEY = "@admin_cooldown_banned";

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

// 🔹 HELPER: Load Interstitial (With Auto-Reload)
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
        // 🔹 LOAD NEXT IMMEDIATELY
        loadInterstitial(); 
    });

    ad.addAdEventListener(AdEventType.ERROR, () => {
        interstitial = null;
        interstitialLoaded = false;
        // Retry loading after a short delay if it fails
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
    
    // --- ADMIN STATES ---
    const [isAdmin, setIsAdmin] = useState(false);
    const [isBanned, setIsBanned] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [pinInput, setPinInput] = useState("");

    const appState = useRef(AppState.currentState);
    const lastProcessedNotificationId = useRef(null);
    const hasHandledRedirect = useRef(false);

    // --- 1. ADMIN INITIALIZATION ---
    useEffect(() => {
        const checkAdminStatus = async () => {
            const banned = await AsyncStorage.getItem(ADMIN_BANNED_KEY);
            if (banned === "true") {
                setIsBanned(true);
                return;
            }
            const enabled = await AsyncStorage.getItem(ADMIN_ENABLED_KEY);
            if (enabled === "true") setIsAdmin(true);
        };
        checkAdminStatus();
    }, []);

    const handlePinSubmit = async () => {
        if (pinInput === SECRET_PIN) {
            await AsyncStorage.setItem(ADMIN_ENABLED_KEY, "true");
            setIsAdmin(true);
            setModalVisible(false);
            Toast.show({ type: 'success', text1: 'Admin Debug Enabled' });
        } else {
            await AsyncStorage.setItem(ADMIN_BANNED_KEY, "true");
            setIsBanned(true);
            setModalVisible(false);
        }
    };

    // --- 2. AD LOGIC ---
    useEffect(() => {
        if (Platform.OS === 'web') return;

        MobileAds().initialize().then(() => {
            loadAppOpenAd();
            loadInterstitial();
        });

        const sub = AppState.addEventListener('change', nextState => {
            // 🔹 APP OPEN ADS: No cooldown, show every time app is resumed
            if (appState.current.match(/inactive|background/) && nextState === 'active') {
                showAppOpenAd();
            }
            appState.current = nextState;
        });

        const interstitialListener = DeviceEventEmitter.addListener("tryShowInterstitial", () => {
            const now = Date.now();
            const timeSinceLast = now - lastShownTime;
            const remaining = Math.max(0, Math.ceil((COOLDOWN_MS - timeSinceLast) / 1000));

            // 🔹 If Admin: Show the toast regardless of success/fail
            if (isAdmin) {
                if (remaining > 0) {
                    Toast.show({
                        type: 'info',
                        text1: 'Ad Cooldown Active',
                        text2: `Next ad available in ${remaining}s`,
                        position: 'bottom'
                    });
                } else if (!interstitialLoaded) {
                    Toast.show({ type: 'error', text1: 'Ad Ready but Not Loaded (No Fill)' });
                }
            }

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
    }, [isAdmin, router]);

    // --- 3. CORE SYSTEM EFFECTS ---
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
                } catch (err) { }
            }
            setTimeout(() => setIsSyncing(false), 1500);
        }
        performSync();
    }, [fontsLoaded, user?.deviceId, isUpdating]);

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

    useEffect(() => { if (fontsLoaded || fontError) SplashScreen.hideAsync(); }, [fontsLoaded, fontError]);

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

            {/* 🔹 INVISIBLE ADMIN TRIGGER (Small box at top) */}
            {!isAdmin && !isBanned && (
                <TouchableOpacity 
                    onPress={() => setModalVisible(true)}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 20, zIndex: 9999, backgroundColor: 'transparent' }}
                />
            )}

            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: isDark ? "#0a0a0a" : "#ffffff" },
                }}
                onStateChange={() => {
                    setTimeout(() => { DeviceEventEmitter.emit("tryShowInterstitial"); }, 500);
                }}
            />
            
            <Toast />

            {/* 🔹 ADMIN PIN MODAL */}
            <Modal visible={modalVisible} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{ backgroundColor: '#111', padding: 30, borderRadius: 20, width: '80%', borderWide: 1, borderColor: '#333' }}>
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16, marginBottom: 20, textAlign: 'center' }}>SYSTEM_AUTH</Text>
                        <TextInput 
                            style={{ backgroundColor: '#222', color: 'white', padding: 15, borderRadius: 10, textAlign: 'center', fontSize: 20, marginBottom: 20 }}
                            keyboardType="numeric"
                            secureTextEntry
                            autoFocus
                            value={pinInput}
                            onChangeText={setPinInput}
                            placeholder="----"
                            placeholderTextColor="#444"
                        />
                        <TouchableOpacity 
                            onPress={handlePinSubmit}
                            style={{ backgroundColor: '#3b82f6', padding: 15, borderRadius: 10 }}
                        >
                            <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>VERIFY</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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
