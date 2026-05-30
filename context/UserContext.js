import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useMMKV } from "react-native-mmkv";
import apiFetch, { setSessionExpiredHandler, syncApiUser } from "../utils/apiFetch";
import { getFingerprint } from "../utils/device";
import { useAlert } from './AlertContext';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const storage = useMMKV();
  const CustomAlert = useAlert(); // ✅ Moved to top level
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // ⚡️ 1. SYNCHRONOUS INIT
  // Renamed the setter to setInternalUser to distinguish between State vs Persistent 
  const [user, setInternalUser] = useState(() => {
    try {
      const stored = storage.getString("mobileUser");
      if (stored) {
        const parsedUser = JSON.parse(stored);
        syncApiUser(parsedUser);
        return parsedUser;
      }
    } catch (e) {
      console.error("Failed to parse user from MMKV", e);
    }
    return null;
  });

  // Keep a mutable reference track of user data to eliminate callback reference mutations safely
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const [loading, setLoading] = useState(() => {
    try {
      const stored = storage.getString("mobileUser");
      return !stored;
    } catch (e) {
      return true;
    }
  });

  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinSuccess, setPinSuccess] = useState(false);
  const hasSyncedIdentity = useRef(false);

  /**
   * 🛠️ DEFENSIVE STORAGE UPDATE
   * This handles standard data updates while the user is active.
   */
  const updateUserData = useCallback((newData) => {
    setInternalUser(newData);

    // Defensive check: Only touch storage if the instance and methods exist
    // This prevents the "undefined is not a function" crash during logout races
    try {
      if (storage && typeof storage.set === 'function') {
        if (newData) {
          storage.set("mobileUser", JSON.stringify(newData));
        } else if (typeof storage.delete === 'function') {
          storage.delete("mobileUser");
        }
      }
    } catch (err) {
      console.warn("MMKV update intercepted during transition:", err);
    }

    syncApiUser(newData);
  }, [storage]);

  /**
   * 🔄 REUSABLE PROFILE PROFILE & INVENTORY SYNC PROTOCOL
   * Pulls the absolute freshest state down from backend DB manually or automatically.
   * Locked cleanly with a user tracking ref to guarantee maximum reference stability.
   */
  const syncProfile = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser?.deviceId) return null;
    try {
      const res = await apiFetch(`/users/me?fingerprint=${currentUser.deviceId}`);
      if (res.status === 200) {
        const dbUser = await res.json();
        const updatedUser = {
          ...currentUser,
          country: dbUser.country || "Unknown",
          username: dbUser.username || currentUser.username,
          referralCode: dbUser.referralCode || currentUser.referralCode,
          invitedUsers: dbUser.invitedUsers || currentUser.invitedUsers || [],
          inventory: dbUser.inventory || currentUser.inventory || [], // Sync inventory changes seamlessly
          securityLevel: dbUser.securityLevel || 0
        };
        updateUserData(updatedUser);

        if (updatedUser.securityLevel < 2 && !pinSuccess) {
          setPinModalVisible(true);
        }
        return updatedUser;
      }
    } catch (fetchErr) {
      console.error("Failed to sync fresh user profile values:", fetchErr);
    }
    return null;
  }, [pinSuccess, updateUserData]);

  /**
   * 🛡️ THE SESSION TERMINATION PROTOCOL
   */
  const handleInternalLogout = useCallback(async (isSystemKick = false) => {
    if (isLoggingOut) return;

    const performCleanup = async () => {
      try {
        setIsLoggingOut(true);

        // ⚡️ 0. NOTIFY BACKEND
        const currentUser = userRef.current;
        if (!isSystemKick && currentUser?.deviceId) {
          try {
            await apiFetch('/mobile/logout', {
              method: 'POST',
              body: { deviceId: currentUser.deviceId }
            });
          } catch (apiErr) {
            if (__DEV__) console.log("Server unreachable. Proceeding with local hibernation.");
          }
        }

        // ⚡️ 1. PREPARE SESSION HISTORY
        let updatedHistory = [];
        try {
          const rawHistory = storage.getString("session_history");
          const sessionHistory = rawHistory ? JSON.parse(rawHistory) : [];

          if (currentUser) {
            const currentSession = {
              uid: currentUser.uid,
              deviceId: currentUser.deviceId,
              username: currentUser.username,
              pfp: currentUser.profilePic?.url || currentUser.image,
            };

            updatedHistory = [
              currentSession,
              ...sessionHistory.filter(s => s && s.uid !== currentSession.uid)
            ].slice(0, 3);
          }
        } catch (historyErr) {
          if (__DEV__) console.log("History preservation skipped.");
        }

        // ⚡️ 2. THE SAFE SWAP
        try {
          if (storage && typeof storage.clearAll === 'function') {
            storage.clearAll();
          } else {
            storage.delete("mobileUser");
            storage.delete("auth_token");
          }

          if (updatedHistory.length > 0 && storage && typeof storage.set === 'function') {
            storage.set("session_history", JSON.stringify(updatedHistory));
          }
        } catch (storageErr) {
          console.warn("Storage purge encountered a snag:", storageErr);
        }

        // ⚡️ 3. CLEANUP & REDIRECT
        await AsyncStorage.clear().catch(() => { });

        setInternalUser(null);
        hasSyncedIdentity.current = false;

        router.replace("/screens/FirstLaunchScreen");

      } catch (error) {
        console.error("Critical Hibernation Error:", error);
        setInternalUser(null);
        router.replace("/screens/FirstLaunchScreen");
      } finally {
        setIsLoggingOut(false);
      }
    };

    if (isSystemKick) {
      CustomAlert(
        "Neural Link Severed",
        "Your session has been terminated. Please log in again to re-establish the connection.",
        [{ text: "Understood", onPress: performCleanup }]
      );
    } else {
      performCleanup();
    }
  }, [isLoggingOut, storage, CustomAlert]);

  // 📡 ATTACH API LISTENER FOR SESSION KICKS
  useEffect(() => {
    setSessionExpiredHandler(() => {
      handleInternalLogout(true);
    });
  }, [handleInternalLogout]);

  // Wrapper for external consumers
  const updateUserDataWrapper = useCallback((newData) => {
    updateUserData(newData);
  }, [updateUserData]);

  // Handle standard app logout triggering
  const handleLogoutExternal = useCallback(() => {
    handleInternalLogout(false);
  }, [handleInternalLogout]);

  // ⚡️ IDENTITY & DATA SYNC
  useEffect(() => {
    const backgroundSyncUser = async () => {
      const currentUser = userRef.current;
      if (!currentUser?.deviceId) {
        setLoading(false);
        return;
      }

      // Identity Sync Protocol
      if ((!currentUser.uid || !currentUser.hardwareId) && !hasSyncedIdentity.current) {
        hasSyncedIdentity.current = true;
        try {
          const fingerprint = await getFingerprint();
          const res = await apiFetch('/mobile/sync-identity', {
            method: 'POST',
            body: {
              deviceId: currentUser.deviceId,
              hardwareId: fingerprint.hardwareId
            }
          });

          if (res.status === 200) {
            const data = await res.json();
            if (data.uid) {
              const updatedUser = {
                ...currentUser,
                uid: data.uid,
                hardwareId: fingerprint.hardwareId,
                securityLevel: data.securityLevel || 0
              };
              updateUserData(updatedUser);

              if (updatedUser.securityLevel < 2 && !pinSuccess) {
                setPinModalVisible(true);
              }
            }
          }
        } catch (err) {
          console.error("Identity Sync Failed:", err);
          hasSyncedIdentity.current = false;
        }
      }

      // Initial Stats Sync fallback if incomplete
      if (!currentUser.referralCode) {
        await syncProfile();
        setLoading(false);
      } else {
        setLoading(false);
      }
    };

    backgroundSyncUser();
  }, [syncProfile, pinSuccess, updateUserData]);

  // 🧠 MEMOIZED CONTEXT VALUE TO PREVENT UNNECESSARY CONSUMER RERENDERS
  const contextValue = useMemo(() => ({
    user,
    setUser: updateUserDataWrapper,
    syncProfile, 
    loading,
    pinModalVisible,
    setPinModalVisible,
    pinSuccess,
    setPinSuccess,
    isLoggingOut,
    handleLogout: handleLogoutExternal
  }), [
    user,
    updateUserDataWrapper,
    syncProfile,
    loading,
    pinModalVisible,
    pinSuccess,
    isLoggingOut,
    handleLogoutExternal
  ]);

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  )
};

export const useUser = () => useContext(UserContext);