import apiFetch from "@/utils/apiFetch";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from 'expo-notifications';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";

const StreakContext = createContext();
const STREAK_CACHE_KEY = "streak_local_cache";
const APP_SECRET = "thisismyrandomsuperlongsecretkey";

// Surgical identifiers to avoid clearing non-streak notifications
const STREAK_NOTIF_IDS = ["streak-24h", "streak-2h", "streak-lost"];

// Set the handler so notifications show when the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// --- UPDATED FUNCTION ---
const scheduleStreakReminders = async (expiresAt, setScheduledList = null) => {
  if (!expiresAt) return;
  try {
    // Permission Check (Critical for Android)
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log("Failed to get push token for push notification!");
      return;
    }

    // Create Channel for Android
    const CHANNEL_ID = 'streak-reminders';
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Streak Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }

    // Surgical Strike: Only cancel existing streak notifications
    // This ensures Clan Wars and other alerts are NOT deleted
    await Promise.all(
      STREAK_NOTIF_IDS.map(id => Notifications.cancelScheduledNotificationAsync(id))
    );

    const expiryDate = new Date(expiresAt).getTime();
    const now = Date.now();
    const GROUP_KEY = "com.oreblogda.STREAK_GROUP";
    
    // 1. 24 Hour Reminder
    const trigger24h = expiryDate - (24 * 60 * 60 * 1000);
    if (trigger24h > now) {
      await Notifications.scheduleNotificationAsync({
        identifier: "streak-24h",
        content: {
          title: "🔥 Streak at Risk!",
          body: "24 hours left to post!",
          data: { screen: 'CreatePost' },
          android: { channelId: CHANNEL_ID, groupKey: GROUP_KEY },
          threadIdentifier: GROUP_KEY
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(trigger24h),
          channelId: CHANNEL_ID // Fixed: Included back in trigger
        },
      });
    }

    // 2. 2 Hour Reminder
    const trigger2h = expiryDate - (2 * 60 * 60 * 1000);
    if (trigger2h > now) {
      await Notifications.scheduleNotificationAsync({
        identifier: "streak-2h",
        content: {
          title: "⚠️ FINAL WARNING",
          body: "2 hours left! Post now!",
          sound: 'default',
          priority: 'high',
          data: { screen: 'CreatePost' },
          android: { channelId: CHANNEL_ID, groupKey: GROUP_KEY },
          threadIdentifier: GROUP_KEY
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(trigger2h),
          channelId: CHANNEL_ID // Fixed: Included back in trigger
        },
      });
    }

    // 3. Expiration Notification
    if (expiryDate > now) {
      await Notifications.scheduleNotificationAsync({
        identifier: "streak-lost",
        content: {
          title: "💀 Streak Lost",
          body: "Your streak has expired.",
          android: { channelId: CHANNEL_ID, groupKey: GROUP_KEY },
          threadIdentifier: GROUP_KEY
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(expiryDate),
          channelId: CHANNEL_ID // Fixed: Included back in trigger
        },
      });
    }

    // Update the list if the setter was provided
    if (setScheduledList) {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      setScheduledList(scheduled);
    }

  } catch (e) {
    console.error("Notif Error:", e);
  }
};

export function StreakProvider({ children }) {
  const [streakData, setStreakData] = useState({
    streak: 0,
    lastPostDate: null,
    canRestore: false,
    recoverableStreak: 0,
    expiresAt: null
  });
  const [loading, setLoading] = useState(true);
  const [scheduledList, setScheduledList] = useState([]);
  const isScheduling = useRef(false);

  const fetchStreak = useCallback(async () => {
    try {
      setLoading(true);
      const userData = await AsyncStorage.getItem("mobileUser");
      if (!userData) return;
      const { deviceId } = JSON.parse(userData);
      if (!deviceId) return;

      const res = await apiFetch(`/users/streak/${deviceId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-oreblogda-secret": APP_SECRET
        }
      });

      if (res.ok) {
        const data = await res.json();
        setStreakData(data);
        await AsyncStorage.setItem(STREAK_CACHE_KEY, JSON.stringify(data));

        if (data.expiresAt && !isScheduling.current) {
          isScheduling.current = true;
          await scheduleStreakReminders(data.expiresAt, setScheduledList);
          isScheduling.current = false;
        }
      }
    } catch (e) {
      console.error("Streak Fetch Error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const saved = await AsyncStorage.getItem(STREAK_CACHE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setStreakData(parsed);
        if (parsed.expiresAt && !isScheduling.current) {
          isScheduling.current = true;
          await scheduleStreakReminders(parsed.expiresAt, setScheduledList);
          isScheduling.current = false;
        }
      }
      fetchStreak();
    };
    init();
  }, [fetchStreak]);

  const value = useMemo(() => ({
    streak: streakData,
    loading,
    refreshStreak: fetchStreak,
    scheduledList, 
  }), [streakData, loading, fetchStreak, scheduledList]);

  return (
    <StreakContext.Provider value={value}>
      {children}
    </StreakContext.Provider>
  );
}

export function useStreak() {
  const context = useContext(StreakContext);
  if (!context) throw new Error("useStreak must be used within a StreakProvider");
  return context;
}
