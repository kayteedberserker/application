import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useMemo, useEffect, useState } from "react";
import useSWR from 'swr';

const StreakContext = createContext();
const STREAK_CACHE_KEY = "streak_local_cache";

// The fetcher handles getting the ID from storage then hitting the API
const streakFetcher = async (url) => {
  const userData = await AsyncStorage.getItem("mobileUser");
  if (!userData) return null;

  const { deviceId } = JSON.parse(userData);
  if (!deviceId) return null;

  const res = await fetch(`${url}/${deviceId}`);
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
      dedupingInterval: 1000 * 60 * 5, // Dedup for 5 mins (shorter for streaks)
      revalidateOnFocus: true,
      fallbackData: initialCache, // Use the cached data as the starting point
    }
  );

  // loading is true only if cache isn't ready AND we have no SWR data
  const loading = !isCacheReady || (!data && !error);

  // 🔹 3. Refresh now supports "Optimistic" updates if needed
  const refreshStreak = () => mutate();

  const value = useMemo(() => ({
    streak: data || initialCache, // Fallback to initialCache if network is slow/offline
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
