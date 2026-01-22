import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useMemo, useEffect, useState } from "react";
import useSWR from 'swr';

const StreakContext = createContext();
const STREAK_CACHE_KEY = "streak_local_cache";
const APP_SECRET = "thisismyrandomsuperlongsecretkey"; // 🔹 Must match your Next.js .env

// The fetcher handles getting the ID from storage then hitting the API
const streakFetcher = async (url) => {
  const userData = await AsyncStorage.getItem("mobileUser");
  if (!userData) return null;

  const { deviceId } = JSON.parse(userData);
  if (!deviceId) return null;

  // 🔹 Updated with Security Header
  const res = await fetch(`${url}/${deviceId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-oreblogda-secret": APP_SECRET // 🛡️ Shielding from bots
    }
  });

  if (!res.ok) throw new Error("Failed to fetch streak");
  
  const data = await res.json();
  
  // 🔹 Update the local cache whenever a network request succeeds
  await AsyncStorage.setItem(STREAK_CACHE_KEY, JSON.stringify(data));
  
  return data;
};

export function StreakProvider({ children }) {
  const [initialCache, setInitialCache] = useState({
    streak: 0, 
    lastPostDate: null, 
    canRestore: false, 
    recoverableStreak: 0 
  });
  const [isCacheReady, setIsCacheReady] = useState(false);

  // 🔹 1. Load from AsyncStorage BEFORE SWR starts
  useEffect(() => {
    const loadCache = async () => {
      try {
        const savedStreak = await AsyncStorage.getItem(STREAK_CACHE_KEY);
        if (savedStreak) {
          setInitialCache(JSON.parse(savedStreak));
        }
      } catch (e) {
        console.error("Streak Cache Load Error:", e);
      } finally {
        setIsCacheReady(true);
      }
    };
    loadCache();
  }, []);

  // 🔹 2. SWR Hook
  const { data, error, mutate, isValidating } = useSWR(
    isCacheReady ? "https://oreblogda.com/api/users/streak" : null, // Only fetch once cache is read
    streakFetcher,
    {
      dedupingInterval: 1000 * 60 * 5, 
      revalidateOnFocus: true,
      fallbackData: initialCache, 
    }
  );

  const loading = !isCacheReady || (!data && !error);

  const refreshStreak = () => mutate();

  const value = useMemo(() => ({
    streak: data || initialCache, 
    loading,
    isValidating,
    refreshStreak
  }), [data, initialCache, loading, isValidating]);

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
