import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import notifee, { AndroidImportance } from '@notifee/react-native';
import Constants from 'expo-constants';
import * as Notifications from "expo-notifications";
import * as Updates from 'expo-updates';
import { AnimatePresence, MotiView } from 'moti';
import { memo, useEffect, useState } from 'react';
import { DeviceEventEmitter, Linking, Modal, Platform, Pressable, Text as RNText, useColorScheme, View } from 'react-native';
import { useMMKV } from 'react-native-mmkv';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import apiFetch from "../utils/apiFetch";

// ⚡️ ALL CONTEXTS IMPORTED
import { useCoins } from '../context/CoinContext';
import { useEvent } from '../context/EventContext';
import { useUser } from '../context/UserContext';
import TitleTag from './TitleTag'; // Ensure this path points to your TitleTag component

const BOOTSTRAP_URL = '/mobile/bootstrap';
const INSTALLED_VERSION = Constants.expoConfig?.version || Constants.manifest?.version || '1.0.0';
const INSTALLED_RUNTIME = Updates.runtimeVersion || 'v1';
const SNOOZE_KEY = 'OREBLOGDA_UPDATE_SNOOZE';
const SNOOZE_DURATION = 60 * 60 * 1000;
let hasCheckedSessionUpdate = false;

const isAppUpdateRequired = (installed, latest) => {
    if (!latest) return false;
    const installedParts = installed.split('.').map(Number);
    const latestParts = latest.split('.').map(Number);
    for (let i = 0; i < Math.max(installedParts.length, latestParts.length); i++) {
        const v1 = installedParts[i] || 0;
        const v2 = latestParts[i] || 0;
        if (v2 > v1) return true;
        if (v2 < v1) return false;
    }
    return false;
};

const isRuntimeUpdateRequired = (installed, latest) => {
    if (!latest) return false;
    const getVersionNumber = (verStr) => {
        const match = String(verStr).match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
    };
    return getVersionNumber(latest) > getVersionNumber(installed);
};

async function registerForPushNotificationsAsync() {
    if (Platform.OS === 'web') return null;
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', { name: 'default', importance: Notifications.AndroidImportance.MAX, vibrationPattern: [0, 250, 250, 250], lightColor: '#FF231F7C' });
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
        const token = (await Notifications.getDevicePushTokenAsync({ projectId })).data;
        return token;
    } catch (e) { return null; }
}

// ⚡️ DYNAMIC VECTOR HYPE ICON GENERATOR (For the Returner Modal)
const HypeIconDisplay = memo(({ tierKey, color, size = 26 }) => {
    const renderLayout = () => {
        if (tierKey === 'MEGA') {
            return (
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name="lightning-bolt" size={size} color={color} style={{ marginBottom: -10, zIndex: 2 }} />
                    <View style={{ flexDirection: 'row' }}>
                        <MaterialCommunityIcons name="lightning-bolt" size={size} color={color} style={{ marginRight: -6 }} />
                        <MaterialCommunityIcons name="lightning-bolt" size={size} color={color} style={{ marginLeft: -6 }} />
                    </View>
                </View>
            );
        }
        if (tierKey === 'SUPER') {
            return (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name="lightning-bolt" size={size * 1.1} color={color} style={{ marginRight: -6 }} />
                    <MaterialCommunityIcons name="lightning-bolt" size={size * 1.1} color={color} style={{ marginLeft: -6 }} />
                </View>
            );
        }
        return <MaterialCommunityIcons name="lightning-bolt" size={size * 1.3} color={color} />;
    };

    return (
        <View style={{ width: 48, height: 48, justifyContent: 'center', alignItems: 'center' }}>
            <MotiView
                from={{ opacity: 0.3, scale: 0.85 }}
                animate={{ opacity: 0.8, scale: 1.15 }}
                transition={{ type: 'timing', duration: 1000, loop: true, direction: 'alternate' }}
                style={{ position: 'absolute', textShadowColor: color, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 }}
            >
                {renderLayout()}
            </MotiView>
            <View style={{ position: 'absolute' }}>
                {renderLayout()}
            </View>
        </View>
    );
});

export default function UpdateHandler() {
    const [visible, setVisible] = useState(false);
    const [showWelcomeBack, setShowWelcomeBack] = useState(false) // ⚡️ Set to true for testing layout
    const [latestVersion, setLatestVersion] = useState(null);
    const [isCritical, setIsCritical] = useState(false)
    const [countdown, setCountdown] = useState(10);
    const [canIgnore, setCanIgnore] = useState(true);

    // ⚡️ ALL SETTERS EXTRACTED
    const { user, setUser, setStreak } = useUser();
    const { setEvents } = useEvent();
    const { setCoinData } = useCoins();
    const storage = useMMKV();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";
    const pulseAnim = useSharedValue(1);

    // ⚡️ NEW: Listen for manual bootstrap triggers from anywhere in the app
    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('RUN_BOOTSTRAP', (data) => {
            runSystemBootstrap(data?.deviceId);
        });
        return () => subscription.remove();
    }, [user?.deviceId]);

    useEffect(() => {
        if (!hasCheckedSessionUpdate && user?.deviceId) {
            hasCheckedSessionUpdate = true;
            runSystemBootstrap();
        }
    }, [user?.deviceId]);

    useEffect(() => {
        if (visible || showWelcomeBack) {
            pulseAnim.value = withRepeat(withSequence(withTiming(1.05, { duration: 800, easing: Easing.inOut(Easing.ease) }), withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })), -1, false);
        } else { pulseAnim.value = 1; }
    }, [visible, showWelcomeBack]);

    const pulseAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseAnim.value }] }));

    useEffect(() => {
        let timer;
        if (visible && isCritical && countdown > 0) {
            setCanIgnore(false);
            timer = setInterval(() => { setCountdown((prev) => prev - 1); }, 1000);
        } else if (countdown === 0) { setCanIgnore(true); }
        return () => clearInterval(timer);
    }, [visible, isCritical, countdown]);

    const runSystemBootstrap = async (customDeviceId = null) => {
        try {
            // ⚡️ Use the customDeviceId if passed from the event emitter, otherwise fallback to context user
            const activeDeviceId = customDeviceId || user?.deviceId;

            if (!activeDeviceId) {
                console.warn("System Bootstrap Aborted: No active device ID found.");
                return;
            }

            if (Platform.OS === 'android') {
                await notifee.createChannel({ id: 'default', name: 'Default Channel', importance: AndroidImportance.HIGH });
            }

            let pushToken = null;
            if (typeof registerForPushNotificationsAsync === 'function') pushToken = await registerForPushNotificationsAsync();

            const response = await apiFetch(BOOTSTRAP_URL, {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceId: activeDeviceId, pushToken: pushToken, platform: Platform.OS })
            });

            // ⚡️ SAFE PARSING
            const rawText = await response.text();
            let resData;

            try {
                resData = JSON.parse(rawText);
            } catch (parseError) {
                console.error(`🚨 System Bootstrap Failed. Server returned non-JSON text: \n"${rawText.slice(0, 150)}..."`);
                return;
            }

            if (resData?.success) {
                if (resData.user) setUser(resData.user);
                if (resData.streak) setStreak(resData.streak);
                if (resData.events) setEvents(resData.events);
                if (resData.coins) setCoinData(resData.coins);

                // ⚡️ TRIGGER WELCOME BACK SEQUENCE
                if (resData.activity?.hasReturned) {
                    setShowWelcomeBack(true);
                }

                if (resData.system) {
                    const systemData = resData.system;
                    setLatestVersion(systemData.appVersion);
                    const runtimeNeedsUpdate = isRuntimeUpdateRequired(INSTALLED_RUNTIME, systemData.runtimeVersion);
                    const appNeedsUpdate = isAppUpdateRequired(INSTALLED_VERSION, systemData.appVersion);
                    const criticalStatus = runtimeNeedsUpdate || systemData.critical;
                    setIsCritical(criticalStatus);
                    if (runtimeNeedsUpdate || appNeedsUpdate) {
                        if (criticalStatus) setVisible(true);
                        else {
                            const lastSnooze = storage.getNumber(SNOOZE_KEY);
                            const now = Date.now();
                            if (!lastSnooze || now - lastSnooze > SNOOZE_DURATION) setVisible(true);
                        }
                    }
                }
            }
        } catch (error) {
            console.error("System Bootstrap network error:", error);
        }
    };

    const handleUpdate = () => {
        const appStoreUrl = Platform.OS === 'ios' ? 'https://apps.apple.com/app/your-app-id' : 'https://play.google.com/store/apps/details?id=com.kaytee.oreblogda';
        Linking.openURL(appStoreUrl);
    };

    const handleSkip = () => {
        if (!canIgnore) return;
        if (!isCritical) storage.set(SNOOZE_KEY, Date.now());
        setVisible(false);
    };

    const themeColor = isCritical ? "#ef4444" : "#2563eb";
    const shadowColor = isCritical ? "#ff0000" : "#3b82f6";
    const welcomeColor = "#a855f7"; // Cyberpunk Purple

    // ⚡️ COMMENTED OUT TO ALLOW LOCAL UI TESTING OVER EXPO GO / EMULATORS
    // if (__DEV__) return null;

    return (
        <>
            {/* ⚡️ CRITICAL SYSTEM UPDATE MODAL */}
            {visible && (
                <Modal visible={visible} transparent animationType="slide">
                    <View className={`flex-1 justify-center items-center px-6 ${isCritical ? 'bg-red-950/90' : 'bg-black/80'}`}>
                        <View style={{ borderWidth: 2, borderColor: themeColor, shadowColor: shadowColor, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 20 }} className={`${isDark ? "bg-[#0d1117]" : "bg-white"} w-full rounded-[32px] overflow-hidden`}>
                            <View style={{ backgroundColor: themeColor }} className="h-[4px] w-full opacity-50" />
                            <View className="p-8 items-center">
                                <Animated.View style={[{ backgroundColor: `${themeColor}20`, borderColor: `${themeColor}40` }, pulseAnimatedStyle]} className="w-16 h-16 rounded-full items-center justify-center mb-6 border">
                                    <Feather name={isCritical ? "alert-triangle" : "download-cloud"} size={32} color={themeColor} />
                                </Animated.View>
                                <RNText className={`text-center font-[900] uppercase italic tracking-tighter text-2xl mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>{isCritical ? "Security Breach" : "System Upgrade"}</RNText>
                                <RNText style={{ color: themeColor }} className="text-center text-[10px] font-black uppercase tracking-[3px] mb-4">{isCritical ? "PROTOCOL_ALPHA_REQUIRED" : `v${latestVersion} Available`}</RNText>
                                <RNText className="text-center text-sm leading-6 text-gray-500 dark:text-gray-400 mb-8 px-2">{isCritical ? "Emergency patches detected. Current build is unstable. System synchronization required to prevent data loss." : "A new transmission patch is ready. Deploy the latest version to maintain optimal connection."}</RNText>
                                <View className="w-full gap-3">
                                    <Animated.View style={pulseAnimatedStyle}>
                                        <Pressable onPress={handleUpdate} style={{ elevation: 10, backgroundColor: themeColor, shadowColor: themeColor, shadowRadius: 10, shadowOpacity: 0.5 }} className="py-4 rounded-2xl flex-row justify-center items-center">
                                            <Ionicons name={isCritical ? "shield-checkmark" : "rocket-sharp"} size={18} color="white" />
                                            <RNText className="text-white font-black uppercase tracking-widest ml-2">Fix System Now</RNText>
                                        </Pressable>
                                    </Animated.View>
                                    <Pressable onPress={handleSkip} disabled={!canIgnore} style={{ opacity: canIgnore ? 1 : 0.3 }} className="py-4 rounded-2xl border border-gray-200 dark:border-gray-800">
                                        <RNText className="text-center text-gray-500 font-bold uppercase tracking-tighter text-xs">{canIgnore ? "Skip for now" : `Overriding lock... ${countdown}s`}</RNText>
                                    </Pressable>
                                </View>
                            </View>
                            <View style={{ backgroundColor: themeColor }} className="h-[2px] w-full opacity-10" />
                        </View>
                        <RNText style={{ color: isCritical ? '#ef4444' : '#6b7280' }} className="text-[9px] mt-4 uppercase tracking-[5px] font-bold text-center">{isCritical ? "SYSTEM_STATUS: COMPROMISED\n" : ""}CORE: {INSTALLED_VERSION} | RUNTIME: {INSTALLED_RUNTIME}</RNText>
                    </View>
                </Modal>
            )}

            {/* ⚡️ NEW: WELCOME BACK REWARD MODAL */}
            <AnimatePresence>
                {showWelcomeBack && !visible && (
                    <Modal visible={showWelcomeBack} transparent animationType="fade">
                        <View className="flex-1 justify-center items-center px-5 bg-black/90">
                            <MotiView
                                from={{ opacity: 0, scale: 0.9, translateY: 20 }}
                                animate={{ opacity: 1, scale: 1, translateY: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ type: 'spring', damping: 20, stiffness: 120 }}
                                style={{
                                    borderWidth: 1,
                                    borderColor: welcomeColor,
                                    shadowColor: welcomeColor,
                                    shadowOffset: { width: 0, height: 10 },
                                    shadowOpacity: 0.4,
                                    shadowRadius: 30,
                                    elevation: 15
                                }}
                                className={`${isDark ? "bg-[#0d1117]" : "bg-white"} w-full rounded-[35px] overflow-hidden p-6 items-center`}
                            >
                                {/* Header */}
                                <View style={{ backgroundColor: `${welcomeColor}15`, borderColor: `${welcomeColor}40` }} className="w-16 h-16 rounded-2xl items-center justify-center mb-5 border shadow-sm">
                                    <MaterialCommunityIcons name="satellite-uplink" size={34} color={welcomeColor} />
                                </View>

                                <RNText style={{ color: welcomeColor }} className="text-center text-[10px] font-black uppercase tracking-[0.3em] mb-1">
                                    System Override
                                </RNText>
                                <RNText className={`text-center font-[900] uppercase italic tracking-tighter text-2xl mb-3 ${isDark ? "text-white" : "text-gray-900"}`}>
                                    Neural Link Restored
                                </RNText>
                                <RNText className="text-center text-xs leading-5 text-gray-500 dark:text-gray-400 mb-6 px-1">
                                    Operator presence detected after an extended cryo-sleep. The system has authorized a compensation cache to accelerate your reintegration.
                                </RNText>

                                {/* Rewards Grid */}
                                <View className="w-full flex-row justify-between mb-4">
                                    {/* Reward 1: Free Hypes */}
                                    <View className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl p-4 items-center mr-2">
                                        <HypeIconDisplay tierKey="FREE" color="#94a3b8" size={24} />
                                        <RNText className="text-white font-black text-xs uppercase mt-2 text-center tracking-widest">2x Free Hype</RNText>
                                        <RNText className="text-slate-500 text-[9px] font-bold uppercase mt-1">Consumable</RNText>
                                    </View>

                                    {/* Reward 2: Streak Boost */}
                                    <View className="flex-1 bg-orange-950/30 border border-orange-900/50 rounded-2xl p-4 items-center ml-2">
                                        <View className="w-12 h-12 justify-center items-center">
                                            <Ionicons name="flame" size={32} color="#f97316" />
                                            <View className="absolute bottom-1 right-0 bg-[#f97316] rounded-full px-1">
                                                <RNText className="text-black text-[8px] font-black">x2</RNText>
                                            </View>
                                        </View>
                                        <RNText className="text-white font-black text-xs uppercase mt-2 text-center tracking-widest">Double Streak</RNText>
                                        <RNText className="text-orange-500/70 text-[9px] font-bold uppercase mt-1">Active 7 Days</RNText>
                                    </View>
                                </View>

                                {/* Reward 3: Title */}
                                <View className="w-full bg-purple-950/20 border border-purple-900/40 rounded-2xl py-5 items-center justify-center mb-8">
                                    <View><TitleTag title="Resurrected" tier="EPIC" size={13} isDark={isDark} isVisible={true} /></View>
                                    <RNText className="text-purple-400/80 text-[9px] font-black uppercase tracking-[0.2em] mt-3">Exclusive Tag Acquired</RNText>
                                </View>

                                {/* Claim Button */}
                                <Animated.View style={[pulseAnimatedStyle, { width: '100%' }]}>
                                    <Pressable
                                        onPress={() => setShowWelcomeBack(false)}
                                        style={{ backgroundColor: welcomeColor, shadowColor: welcomeColor, shadowRadius: 15, shadowOpacity: 0.6, elevation: 10 }}
                                        className="py-4 w-full rounded-xl flex-row justify-center items-center"
                                    >
                                        <MaterialCommunityIcons name="download-network" size={20} color="white" />
                                        <RNText className="text-white font-black uppercase tracking-[0.2em] text-xs ml-2">Claim Cache</RNText>
                                    </Pressable>
                                </Animated.View>

                            </MotiView>
                        </View>
                    </Modal>
                )}
            </AnimatePresence>
        </>
    );
}