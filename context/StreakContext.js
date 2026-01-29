import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useMemo, useEffect, useState, useCallback, useRef } from "react";
import * as Notifications from "expo-notifications";
import { Platform, View, ActivityIndicator } from "react-native";

const StreakContext = createContext();

const STREAK_CACHE_KEY = "streak_local_cache";
const STREAK_NOTIFICATION_KEY = "streak_notification_ids";
const APP_SECRET = "thisismyrandomsuperlongsecretkey";

/* ------------------------------------------------------------------ */
/* 🔔 STREAK NOTIFICATION SCHEDULER                                     */
/* ------------------------------------------------------------------ */
const scheduleStreakReminders = async (expiresAt) => {
  if (!expiresAt) return;

  try {
    const now = Date.now();
    const expiryTime = new Date(expiresAt).getTime();

    // 🛡️ FIX 1: If the streak is already expired, don't schedule anything!
    if (expiryTime <= now) {
      console.log("Streak already expired, skipping notifications.");
      return;
    }

    // 1. Clear existing streak notifications first
    const stored = await AsyncStorage.getItem(STREAK_NOTIFICATION_KEY);
    if (stored) {
      const existingIds = JSON.parse(stored);
      if (Array.isArray(existingIds)) {
        await Promise.all(
          existingIds.map(id => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
        );
      }
    }

    const newIds = [];

    const safeSchedule = async (title, body, targetTimestamp, data = {}) => {
      // 🛡️ FIX 2: Buffer of 10 seconds to account for execution lag
      const secondsUntil = Math.floor((targetTimestamp - Date.now()) / 1000);
      
      if (secondsUntil <= 10) return; 

      const id = await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: true, data },
        trigger: {
          seconds: secondsUntil,
          channelId: "default",
        },
      });
      newIds.push(id);
    };

    // 🔹 Reminders
    await safeSchedule("🔥 Streak at Risk!", "24 hours left!", expiryTime - 24 * 60 * 60 * 1000);
    await safeSchedule("⚠️ FINAL WARNING", "2 hours left!", expiryTime - 2 * 60 * 60 * 1000);
    await safeSchedule("💀 Streak Lost", "Your streak has expired.", expiryTime);

    await AsyncStorage.setItem(STREAK_NOTIFICATION_KEY, JSON.stringify(newIds));
  } catch (e) {
    console.error("Streak Notification Error:", e);
  }
};

/* ------------------------------------------------------------------ */
/* 🧠 STREAK PROVIDER                                                   */
/* ------------------------------------------------------------------ */
export function StreakProvider({ children }) {
  const [streakData, setStreakData] = useState({
    streak: 0,
    lastPostDate: null,
    canRestore: false,
    recoverableStreak: 0,
    expiresAt: null,
  });

  const [loading, setLoading] = useState(true);
  const lastScheduledTime = useRef(null); // 🛡️ FIX 3: Prevent double-scheduling

  const fetchStreak = useCallback(async () => {
    // Show loading for any fetch that includes loading per instructions
    setLoading(true); 
    try {
      const userData = await AsyncStorage.getItem("mobileUser");
      if (!userData) return;

      const { deviceId } = JSON.parse(userData);
      const res = await fetch(`https://oreblogda.com/api/users/streak/${deviceId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json", "x-oreblogda-secret": APP_SECRET },
      });

      if (res.ok) {
        const data = await res.json();
        setStreakData(data);
        await AsyncStorage.setItem(STREAK_CACHE_KEY, JSON.stringify(data));

        // Only schedule if the expiry time has actually changed
        if (data.expiresAt && data.expiresAt !== lastScheduledTime.current) {
          lastScheduledTime.current = data.expiresAt;
          await scheduleStreakReminders(data.expiresAt);
        }
      }
    } catch (e) {
      console.error("Streak Fetch Error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      const saved = await AsyncStorage.getItem(STREAK_CACHE_KEY);
      if (saved && isMounted) {
        const parsed = JSON.parse(saved);
        setStreakData(parsed);
        // Note: We DON'T schedule from cache to avoid "Opening App Spam"
        // We wait for the fresh fetchStreak call below.
      }
      await fetchStreak();
    };
    init();
    return () => { isMounted = false; };
  }, [fetchStreak]);

  const value = useMemo(() => ({
    streak: streakData,
    loading,
    refreshStreak: fetchStreak,
  }), [streakData, loading, fetchStreak]);

  return (
    <StreakContext.Provider value={value}>
      {/* Loading animation for the initial load */}
      {loading && streakData.streak === 0 ? (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
           <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : children}
    </StreakContext.Provider>
  );
}

export function useStreak() {
  const context = useContext(StreakContext);
  if (!context) throw new Error("useStreak must be used within a StreakProvider");
  return context;
}
