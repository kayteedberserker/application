import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from "expo-router";
import { createContext, useContext, useEffect, useRef, useState } from "react";
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
  const updateUserData = (newData) => {
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
  };

  /**
   * 🛡️ THE SESSION TERMINATION PROTOCOL
   */
  const handleInternalLogout = async (isSystemKick = false) => {
    // ❌ const CustomAlert = useAlert() <- This was the cause of the error
    if (isLoggingOut) return;

    const performCleanup = async () => {
      try {
        setIsLoggingOut(true);

        // ⚡️ 0. NOTIFY BACKEND
        if (!isSystemKick && user?.deviceId) {
          try {
            await apiFetch('/mobile/logout', {
              method: 'POST',
              body: { deviceId: user.deviceId }
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

          if (user) {
            const currentSession = {
              uid: user.uid,
              deviceId: user.deviceId,
              username: user.username,
              pfp: user.profilePic?.url || user.image,
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
        // We purge storage first
        try {
          if (storage && typeof storage.clearAll === 'function') {
            storage.clearAll();
          } else {
            storage.delete("mobileUser");
            storage.delete("auth_token");
          }

          // Re-inject history if we have it
          if (updatedHistory.length > 0 && storage && typeof storage.set === 'function') {
            storage.set("session_history", JSON.stringify(updatedHistory));
          }
        } catch (storageErr) {
          console.warn("Storage purge encountered a snag:", storageErr);
        }

        // ⚡️ 3. CLEANUP & REDIRECT
        await AsyncStorage.clear().catch(() => { });

        // IMPORTANT: We call setInternalUser directly to avoid updateUserData
        setInternalUser(null);
        hasSyncedIdentity.current = false;

        // Force transition to entry point
        router.replace("/screens/FirstLaunchScreen");

      } catch (error) {
        console.error("Critical Hibernation Error:", error);
        // Fallback: Clear state and force redirect even if storage exploded
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
  };

  // 📡 ATTACH API LISTENER FOR SESSION KICKS
  useEffect(() => {
    setSessionExpiredHandler(() => {
      handleInternalLogout(true);
    });
  }, [user?.deviceId]);

  // Wrapper for external consumers
  const updateUserDataWrapper = (newData) => {
    updateUserData(newData);
  };

  // ⚡️ IDENTITY & DATA SYNC
  useEffect(() => {
    const backgroundSyncUser = async () => {
      if (!user?.deviceId) {
        setLoading(false);
        return;
      }

      // Identity Sync Protocol
      if ((!user.uid || !user.hardwareId) && !hasSyncedIdentity.current) {
        hasSyncedIdentity.current = true;
        try {
          const fingerprint = await getFingerprint();
          const res = await apiFetch('/mobile/sync-identity', {
            method: 'POST',
            body: {
              deviceId: user.deviceId,
              hardwareId: fingerprint.hardwareId
            }
          });

          if (res.status === 200) {
            const data = await res.json();
            if (data.uid) {
              const updatedUser = {
                ...user,
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

      // Stats Sync
      if (!user.referralCode) {
        try {
          const res = await apiFetch(`/users/me?fingerprint=${user.deviceId}`);
          if (res.status === 200) {
            const dbUser = await res.json();
            const updatedUser = {
              ...user,
              country: dbUser.country || "Unknown",
              username: dbUser.username || user.username,
              referralCode: dbUser.referralCode || user.referralCode,
              invitedUsers: dbUser.invitedUsers || user.invitedUsers || [],
              securityLevel: dbUser.securityLevel || 0
            };
            updateUserData(updatedUser);

            if (updatedUser.securityLevel < 2 && !pinSuccess) {
              setPinModalVisible(true);
            }
          }
        } catch (fetchErr) {
          console.error("Failed to sync user stats:", fetchErr);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    backgroundSyncUser();
  }, [user?.deviceId, user?.uid, user?.hardwareId]);

  return (
    <UserContext.Provider
      value={{
        user,
        setUser: updateUserDataWrapper,
        loading,
        pinModalVisible,
        setPinModalVisible,
        pinSuccess,
        setPinSuccess,
        isLoggingOut,
        handleLogout: () => handleInternalLogout(false)
      }}>
      {children}
    </UserContext.Provider>
  )
};

export const useUser = () => useContext(UserContext);