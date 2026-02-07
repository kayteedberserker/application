import apiFetch from "@/utils/apiFetch";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from 'expo-notifications';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const StreakContext = createContext();
const STREAK_CACHE_KEY = "streak_local_cache";
const APP_SECRET = "thisismyrandomsuperlongsecretkey";

// --- UPDATED FUNCTION ---
const scheduleStreakReminders = async (expiresAt) => {
  if (!expiresAt) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const expiryDate = new Date(expiresAt).getTime();
    const now = Date.now();

    // 1. 24 Hour Reminder
    const trigger24h = expiryDate - (24 * 60 * 60 * 1000);
    if (trigger24h > now) {
      await Notifications.scheduleNotificationAsync({
        content: { 
          title: "🔥 Streak at Risk!", 
          body: "24 hours left to post!", 
          data: { screen: 'CreatePost' } 
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE, // Fixed
          date: new Date(trigger24h),
        },
      });
    }

    // 2. 2 Hour Reminder
    const trigger2h = expiryDate - (2 * 60 * 60 * 1000);
    if (trigger2h > now) {
      await Notifications.scheduleNotificationAsync({
        content: { 
          title: "⚠️ FINAL WARNING", 
          body: "2 hours left! Post now!", 
          sound: 'default', 
          priority: 'high' 
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE, // Fixed
          date: new Date(trigger2h),
        },
      });
    }

    // 3. Expiration Notification
    if (expiryDate > now) {
      await Notifications.scheduleNotificationAsync({
        content: { title: "💀 Streak Lost", body: "Your streak has expired." },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE, // Fixed
          date: new Date(expiryDate),
        },
      });
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

  const fetchStreak = useCallback(async () => {
    try {
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
        if (data.expiresAt) scheduleStreakReminders(data.expiresAt);
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
        if (parsed.expiresAt) scheduleStreakReminders(parsed.expiresAt);
      }
      fetchStreak();
    };
    init();
  }, [fetchStreak]);

  const value = useMemo(() => ({
    streak: streakData,
    loading,
    refreshStreak: fetchStreak 
  }), [streakData, loading, fetchStreak]);

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