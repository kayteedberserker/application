import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { router } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { useMMKV } from "react-native-mmkv";
import apiFetch, { setSessionExpiredHandler, syncApiUser } from "../utils/apiFetch";
import { getFingerprint } from "../utils/device";
import { useAlert } from './AlertContext';
const UserContext = createContext();
const STREAK_CACHE_KEY = "streak_local_cache";
const APP_SECRET = "thisismyrandomsuperlongsecretkey";
const STREAK_NOTIF_IDS = ["streak-24h", "streak-2h", "streak-lost"];
const scheduleStreakReminders = async (expiresAt) => {
    if (!expiresAt) return [];
    try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') return [];
        const CHANNEL_ID = 'streak-reminders';
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
                name: 'Streak Reminders',
                importance: Notifications.AndroidImportance.HIGH,
                sound: 'default',
            });
        }
        await Promise.all(STREAK_NOTIF_IDS.map(id => Notifications.cancelScheduledNotificationAsync(id)));
        const expiryDate = new Date(expiresAt).getTime();
        const now = Date.now();
        const GROUP_KEY = "com.oreblogda.STREAK_GROUP";
        const trigger24h = expiryDate - (24 * 60 * 60 * 1000);
        if (trigger24h > now) {
            await Notifications.scheduleNotificationAsync({
                identifier: "streak-24h",
                content: { title: "🔥 Streak at Risk!", body: "24 hours left to post!", data: { screen: 'CreatePost' }, android: { channelId: CHANNEL_ID, groupKey: GROUP_KEY }, threadIdentifier: GROUP_KEY },
                trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(trigger24h), channelId: CHANNEL_ID },
            });
        }
        const trigger2h = expiryDate - (2 * 60 * 60 * 1000);
        if (trigger2h > now) {
            await Notifications.scheduleNotificationAsync({
                identifier: "streak-2h",
                content: { title: "⚠️ FINAL WARNING", body: "2 hours left! Post now!", sound: true, priority: 'high', data: { screen: 'CreatePost' }, android: { channelId: CHANNEL_ID, groupKey: GROUP_KEY }, threadIdentifier: GROUP_KEY },
                trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(trigger2h), channelId: CHANNEL_ID },
            });
        }
        if (expiryDate > now) {
            await Notifications.scheduleNotificationAsync({
                identifier: "streak-lost",
                content: { title: "💀 Streak Lost", body: "Your streak has expired.", android: { channelId: CHANNEL_ID, groupKey: GROUP_KEY }, threadIdentifier: GROUP_KEY },
                trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(expiryDate), channelId: CHANNEL_ID },
            });
        }
        return await Notifications.getAllScheduledNotificationsAsync();
    } catch (e) {
        console.error("Notif Error:", e);
        return [];
    }
};
export const UserProvider = ({ children }) => {
    const storage = useMMKV();
    const CustomAlert = useAlert();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    // ⚡️ USER INIT
    const [user, setInternalUser] = useState(() => {
        try {
            const stored = storage.getString("mobileUser");
            if (stored) {
                const parsedUser = JSON.parse(stored);
                syncApiUser(parsedUser);
                return parsedUser;
            }
        } catch (e) { console.error("Parse user error", e); }
        return null;
    });
    const userRef = useRef(user);
    useEffect(() => { userRef.current = user; }, [user]);
    const [pinModalVisible, setPinModalVisible] = useState(false);
    const [pinSuccess, setPinSuccess] = useState(false);
    const hasSyncedIdentity = useRef(false);
    // ⚡️ STREAK INIT
    const [streakData, setStreakDataLocal] = useState(() => {
        try {
            const saved = storage.getString(STREAK_CACHE_KEY);
            if (saved) return JSON.parse(saved);
        } catch (e) { console.error("Cache Read Error", e); }
        return { streak: 0, lastPostDate: null, canRestore: false, recoverableStreak: 0, expiresAt: null };
    });
    const [scheduledList, setScheduledList] = useState([]);
    const isScheduling = useRef(false);
    const [loading, setLoading] = useState(() => {
        return !storage.getString("mobileUser") || !storage.getString(STREAK_CACHE_KEY);
    });
    // ⚡️ SETTERS
    const updateUserData = useCallback((newData) => {
        setInternalUser(newData);
        try {
            if (storage && typeof storage.set === 'function') {
                if (newData) {
                    storage.set("mobileUser", JSON.stringify(newData));
                } else if (typeof storage.delete === 'function') {
                    storage.delete("mobileUser");
                }
            }
        } catch (err) { console.warn("MMKV err:", err); }
        syncApiUser(newData);
        if (newData?.securityLevel < 2 && !pinSuccess) setPinModalVisible(true);
        setLoading(false);
    }, [storage, pinSuccess]);
    const updateStreakData = useCallback(async (newStreak) => {
        setStreakDataLocal(newStreak);
        storage.set(STREAK_CACHE_KEY, JSON.stringify(newStreak));
        if (newStreak.expiresAt && !isScheduling.current) {
            isScheduling.current = true;
            const scheduled = await scheduleStreakReminders(newStreak.expiresAt);
            setScheduledList(scheduled);
            isScheduling.current = false;
        }
        setLoading(false);
    }, [storage]);
    // ⚡️ MERGED FETCH PROTOCOL (Hits the new combined `/users/me` route)
    const syncProfile = useCallback(async () => {
        const currentUser = userRef.current;
        if (!currentUser?.deviceId) return null;
        try {
            const res = await apiFetch(`/users/me?fingerprint=${currentUser.deviceId}`, {
                headers: { "x-oreblogda-secret": APP_SECRET }
            });
            if (res.status === 200) {
                const data = await res.json();
                if (data.user) {
                    const updatedUser = {
                        ...currentUser,
                        ...data.user,
                        country: data.user.country || "Unknown",
                        username: data.user.username || currentUser.username,
                        inventory: data.user.inventory || currentUser.inventory || []
                    };
                    updateUserData(updatedUser);
                }
                if (data.streak) {
                    updateStreakData(data.streak);
                }
                return data;
            }
        } catch (fetchErr) { console.error("Failed to sync fresh profile values:", fetchErr); }
        return null;
    }, [updateUserData, updateStreakData]);
    // Standalone Streak Refresh (Kept for strict refresh gestures)
    const refreshStreak = useCallback(async () => {
        const currentUser = userRef.current;
        if (!currentUser?.deviceId) return;
        try {
            const res = await apiFetch(`/users/streak/${currentUser.deviceId}`, { headers: { "Content-Type": "application/json", "x-oreblogda-secret": APP_SECRET } });
            if (res.ok) {
                const data = await res.json();
                updateStreakData(data);
            }
        } catch (e) { console.error("Streak Fetch Error:", e); }
    }, [updateStreakData]);
    // ⚡️ LOGOUT PROTOCOL (Combined)
    const handleInternalLogout = useCallback(async (isSystemKick = false) => {
        if (isLoggingOut) return;
        const performCleanup = async () => {
            try {
                setIsLoggingOut(true);
                const currentUser = userRef.current;
                if (!isSystemKick && currentUser?.deviceId) {
                    try { await apiFetch('/mobile/logout', { method: 'POST', body: { deviceId: currentUser.deviceId } }); } catch (apiErr) { }
                }
                let updatedHistory = [];
                try {
                    const rawHistory = storage.getString("session_history");
                    const sessionHistory = rawHistory ? JSON.parse(rawHistory) : [];
                    if (currentUser) {
                        const currentSession = { uid: currentUser.uid, deviceId: currentUser.deviceId, username: currentUser.username, pfp: currentUser.profilePic?.url || currentUser.image };
                        updatedHistory = [currentSession, ...sessionHistory.filter(s => s && s.uid !== currentSession.uid)].slice(0, 3);
                    }
                } catch (historyErr) { }
                try {
                    if (storage && typeof storage.clearAll === 'function') storage.clearAll();
                    else { storage.delete("mobileUser"); storage.delete("auth_token"); storage.delete(STREAK_CACHE_KEY); }
                    if (updatedHistory.length > 0 && storage) storage.set("session_history", JSON.stringify(updatedHistory));
                } catch (storageErr) { }
                await Promise.all(STREAK_NOTIF_IDS.map(id => Notifications.cancelScheduledNotificationAsync(id).catch(() => { })));
                await AsyncStorage.clear().catch(() => { });
                setInternalUser(null);
                setStreakDataLocal({ streak: 0, lastPostDate: null, canRestore: false, recoverableStreak: 0, expiresAt: null });
                hasSyncedIdentity.current = false;
                router.replace("/screens/FirstLaunchScreen");
            } catch (error) {
                setInternalUser(null);
                router.replace("/screens/FirstLaunchScreen");
            } finally {
                setIsLoggingOut(false);
            }
        };
        if (isSystemKick) {
            CustomAlert("Neural Link Severed", "Your session has been terminated. Please log in again.", [{ text: "Understood", onPress: performCleanup }]);
        } else {
            performCleanup();
        }
    }, [isLoggingOut, storage, CustomAlert]);
    useEffect(() => {
        setSessionExpiredHandler(() => { handleInternalLogout(true); });
    }, [handleInternalLogout]);
    // ⚡️ IDENTITY SYNC (Preserved, but profile auto-fetch removed)
    useEffect(() => {
        const backgroundSyncIdentity = async () => {
            const currentUser = userRef.current;
            if (!currentUser?.deviceId) {
                setLoading(false);
                return;
            }
            if ((!currentUser.uid || !currentUser.hardwareId) && !hasSyncedIdentity.current) {
                hasSyncedIdentity.current = true;
                try {
                    const fingerprint = await getFingerprint();
                    const res = await apiFetch('/mobile/sync-identity', { method: 'POST', body: { deviceId: currentUser.deviceId, hardwareId: fingerprint.hardwareId } });
                    if (res.status === 200) {
                        const data = await res.json();
                        if (data.uid) {
                            updateUserData({ ...currentUser, uid: data.uid, hardwareId: fingerprint.hardwareId, securityLevel: data.securityLevel || 0 });
                        }
                    }
                } catch (err) {
                    console.error("Identity Sync Failed:", err);
                    hasSyncedIdentity.current = false;
                }
            }
        };
        backgroundSyncIdentity();
    }, [updateUserData]);
    const updateUserDataWrapper = useCallback((newData) => { updateUserData(newData); }, [updateUserData]);
    const handleLogoutExternal = useCallback(() => { handleInternalLogout(false); }, [handleInternalLogout]);
    const contextValue = useMemo(() => ({
        // User API
        user,
        setUser: updateUserDataWrapper,
        syncProfile,
        loading,
        pinModalVisible,
        setPinModalVisible,
        pinSuccess,
        setPinSuccess,
        isLoggingOut,
        handleLogout: handleLogoutExternal,
        // Streak API
        streak: streakData,
        setStreak: updateStreakData,
        refreshStreak,
        scheduledList,
    }), [user, updateUserDataWrapper, syncProfile, loading, pinModalVisible, pinSuccess, isLoggingOut, handleLogoutExternal, streakData, updateStreakData, refreshStreak, scheduledList]);
    return (
        <UserContext.Provider value={contextValue}>
            {children}
        </UserContext.Provider>
    );
};
export const useUser = () => useContext(UserContext);