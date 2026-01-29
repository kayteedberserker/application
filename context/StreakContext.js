import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useMemo, useEffect, useState, useCallback } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

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

    // 1. Clear existing streak notifications first to avoid duplicates
    const stored = await AsyncStorage.getItem(STREAK_NOTIFICATION_KEY);
    if (stored) {
      const existingIds = JSON.parse(stored);
      await Promise.all(
        existingIds.map(id => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
      );
    }

    const newIds = [];

    // Helper to schedule ONLY if the target time is in the future
    const safeSchedule = async (title, body, targetTimestamp, data = {}) => {
      const secondsUntil = Math.floor((targetTimestamp - now) / 1000);
      
      // 🛡️ CRITICAL FIX: If seconds <= 0, the time is in the past. 
      // Do NOT schedule, or it will fire immediately.
      if (secondsUntil <= 0) return;

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          data,
        },
        trigger: {
          seconds: secondsUntil,
          channelId: "default",
        },
      });
      newIds.push(id);
    };

    // 🔹 24h reminder (Only if expiry is more than 24h away)
    await safeSchedule(
      "🔥 Streak at Risk!",
      "24 hours left to post!",
      expiryTime - 24 * 60 * 60 * 1000,
      { screen: "CreatePost" }
    );

    // 🔹 2h reminder (Only if expiry is more than 2h away)
    await safeSchedule(
      "⚠️ FINAL WARNING",
      "2 hours left! Post now!",
      expiryTime - 2 * 60 * 60 * 1000,
      { screen: "CreatePost" }
    );

    // 🔹 Expiry notification
    await safeSchedule(
      "💀 Streak Lost",
      "Your streak has expired.",
      expiryTime
    );

    // Save the new IDs so we can cancel them later
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

  const fetchStreak = useCallback(async () => {
    try {
      const userData = await AsyncStorage.getItem("mobileUser");
      if (!userData) {
        setLoading(false);
        return;
      }

      const parsedUser = JSON.parse(userData);
      const deviceId = parsedUser?.deviceId;
      if (!deviceId) {
        setLoading(false);
        return;
      }

      const res = await fetch(
        `https://oreblogda.com/api/users/streak/${deviceId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "x-oreblogda-secret": APP_SECRET,
          },
        }
      );

      if (res.ok) {
        const data = await res.json();
        setStreakData(data);
        await AsyncStorage.setItem(STREAK_CACHE_KEY, JSON.stringify(data));

        if (data.expiresAt) {
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
      try {
        // 1. Load from cache first for instant UI
        const saved = await AsyncStorage.getItem(STREAK_CACHE_KEY);
        if (saved && isMounted) {
          const parsed = JSON.parse(saved);
          setStreakData(parsed);
          // Don't schedule here yet, wait for fresh data or 
          // do it once fresh data fails.
        }

        // 2. Fetch fresh data
        await fetchStreak();
      } catch (err) {
        console.error("Init Streak Error:", err);
      }
    };

    init();
    return () => { isMounted = false; };
  }, [fetchStreak]);

  const value = useMemo(
    () => ({
      streak: streakData,
      loading,
      refreshStreak: fetchStreak,
    }),
    [streakData, loading, fetchStreak]
  );

  return (
    <StreakContext.Provider value={value}>
      {children}
    </StreakContext.Provider>
  );
}

export function useStreak() {
  const context = useContext(StreakContext);
  if (!context) {
    throw new Error("useStreak must be used within a StreakProvider");
  }
  return context;
}
