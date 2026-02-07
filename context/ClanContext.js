import apiFetch from "@/utils/apiFetch";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useUser } from "./UserContext";

const ClanContext = createContext();

export const ClanProvider = ({ children }) => {
  const { user } = useUser();
  const [userClan, setUserClan] = useState(null);
  const [allClans, setAllClans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const hasSynced = useRef(false); // 🔹 Prevent re-syncing on every re-render

  // 1. Initial Load from AsyncStorage
  useEffect(() => {
    const loadStoredClan = async () => {
      try {
        const stored = await AsyncStorage.getItem("userClan");
        if (stored) {
          setUserClan(JSON.parse(stored));
        }
      } catch (e) {
        console.error("Failed to load clan from storage", e);
      } finally {
        // If there's no user yet, we might still be loading, 
        // but initial storage check is done.
        if (!user?.deviceId) {
           setIsLoading(false);
        }
      }
    };
    loadStoredClan();
  }, []);

  // 2. Sync with Backend ONLY ONCE when deviceId is found
  useEffect(() => {
    if (user?.deviceId && !hasSynced.current) {
      hasSynced.current = true; // 🔹 Lock it so it never runs again this session
      refreshClanStatus(user.deviceId);
    } else if (user?.deviceId) {
      setIsLoading(false);
    }
  }, [user?.deviceId]);

  const refreshClanStatus = async (deviceId) => {
    if (!deviceId) return;
    setIsLoading(true);
    try {
      const response = await apiFetch(`/clans?fingerprint=${deviceId}`);
      const data = await response.json();
        
      if (data.userInClan) {
        // This 'data.userClan' now contains the 'role' (leader/viceleader/member)
        setUserClan(data.userClan);
        await AsyncStorage.setItem("userClan", JSON.stringify(data.userClan));
      } else {
        setUserClan(null);
        await AsyncStorage.removeItem("userClan");
      }

      if (data.clans) {
        setAllClans(data.clans);
      }
    } catch (error) {
      console.error("Error syncing clan status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearClanData = async () => {
    setUserClan(null);
    await AsyncStorage.removeItem("userClan");
  };

  // Helper values for easier UI checks
  const userRole = userClan?.role || null;
  const isLeader = userRole === "leader";
  const isViceLeader = userRole === "viceleader";
  const canManageClan = isLeader || isViceLeader;
  
  return (
    <ClanContext.Provider
      value={{
        userClan,
        allClans,
        isLoading,
        refreshClanStatus: () => refreshClanStatus(user?.deviceId),
        clearClanData,
        isInClan: !!userClan,
        userRole,
        isLeader,
        isViceLeader,
        canManageClan, // 🛡️ Useful for showing/hiding "Accept War" buttons
      }}
    >
      {children}
    </ClanContext.Provider>
  );
};

export const useClan = () => useContext(ClanContext);