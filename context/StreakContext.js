import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useMemo, useEffect, useState, useCallback } from "react";
import * as Notifications from "expo-notifications";

const StreakContext = createContext();

const STREAK_CACHE_KEY = "streak_local_cache";
const STREAK_NOTIFICATION_KEY = "streak_notification_ids";
const APP_SECRET = "thisismyrandomsuperlongsecretkey";

/* ------------------------------------------------------------------ */
/* 🔔 STREAK NOTIFICATION SCHEDULER (SAFE & IDEMPOTENT)                 */
/* ------------------------------------------------------------------ */
const scheduleStreakReminders = async (expiresAt) => {
  if (!expiresAt) return;

  try {
    const now = Date.now();
    const expiryDate = new Date(expiresAt).getTime();

    // 🔹 Cancel only previous streak notifications
    const stored = await AsyncStorage.getItem(STREAK_NOTIFICATION_KEY);
    const existingIds = stored ? JSON.parse(stored) : [];

    for (const id of existingIds) {
      await Notifications.cancelScheduledNotificationAsync(id);
    }

    const newIds = [];

    const schedule = async (title, body, triggerTime, data) => {
      const seconds = Math.floor((triggerTime - now) / 1000);
      if (seconds <= 0) return;

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          data,
        },
        trigger: {
          seconds,
          channelId: "default",
        },
      });

      newIds.push(id);
    };

    // 🔹 24h reminder
    await schedule(
      "🔥 Streak at Risk!",
      "24 hours left to post!",
      expiryDate - 24 * 60 * 60 * 1000,
      { screen: "CreatePost" }
    );

    // 🔹 2h reminder
    await schedule(
      "⚠️ FINAL WARNING",
      "2 hours left! Post now!",
      expiryDate - 2 * 60 * 60 * 1000,
      { screen: "CreatePost" }
    );

    // 🔹 Expiry notification
    await schedule(
      "💀 Streak Lost",
      "Your streak has expired.",
      expiryDate
    );

    // 🔹 Save new IDs
    await AsyncStorage.setItem(
      STREAK_NOTIFICATION_KEY,
      JSON.stringify(newIds)
    );
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

  // 🔹 Manual fetcher (call after post creation)
  const fetchStreak = useCallback(async () => {
    try {
      const userData = await AsyncStorage.getItem("mobileUser");
      if (!userData) return;

      const { deviceId } = JSON.parse(userData);
      if (!deviceId) return;

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

        // 🔹 Always reschedule on fresh data
        if (data.expiresAt) {
          scheduleStreakReminders(data.expiresAt);
        }
      }
    } catch (e) {
      console.error("Streak Fetch Error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // 🔹 Load cache + reschedule EVERY app launch
  useEffect(() => {
    const init = async () => {
      const saved = await AsyncStorage.getItem(STREAK_CACHE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setStreakData(parsed);

        if (parsed.expiresAt) {
          scheduleStreakReminders(parsed.expiresAt);
        }
      }

      fetchStreak(); // refresh + reschedule again
    };

    init();
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

/* ------------------------------------------------------------------ */
/* 🪝 HOOK                                                             */
/* ------------------------------------------------------------------ */
export function useStreak() {
  const context = useContext(StreakContext);
  if (!context) {
    throw new Error("useStreak must be used within a StreakProvider");
  }
  return context;
}
