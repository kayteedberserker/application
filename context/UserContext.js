import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useMMKV } from "react-native-mmkv";
import apiFetch, { syncApiUser } from "../utils/apiFetch";
import { getFingerprint } from "../utils/device";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const storage = useMMKV();

  // ⚡️ 1. SYNCHRONOUS INIT
  const [user, setUser] = useState(() => {
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
    const stored = storage.getString("mobileUser");
    return !stored;
  });

  // 🛡️ SECURITY STATE: Controls the NeuralPinModal globally
  const [pinModalVisible, setPinModalVisible] = useState(false);

  const hasSyncedIdentity = useRef(false);

  const updateUserData = (newData) => {
    setUser(newData);
    storage.set("mobileUser", JSON.stringify(newData));
    syncApiUser(newData);
  };

  useEffect(() => {
    const backgroundSyncUser = async () => {
      if (!user?.deviceId) {
        setLoading(false);
        return;
      }

      // ⚡️ IDENTITY SYNC PROTOCOL
      if ((!user.uid || !user.hardwareId) && !hasSyncedIdentity.current) {
        hasSyncedIdentity.current = true;
        try {
          const fingerprint = await getFingerprint();
          const res = await apiFetch('/mobile/sync-identity', {
            method: 'POST',
            body: JSON.stringify({
              deviceId: user.deviceId,
              hardwareId: fingerprint.hardwareId
            })
          });

          if (res.ok) {
            const data = await res.json();
            if (data.uid) {
              const updatedUser = {
                ...user,
                uid: data.uid,
                hardwareId: fingerprint.hardwareId,
                securityLevel: data.securityLevel || 0 // Track security level
              };
              updateUserData(updatedUser);

              // 🛡️ AUTO-TRIGGER: If new user or securityLevel is 0, force PIN setup
              if (!data.securityLevel || data.securityLevel < 2) {
                setPinModalVisible(true);
              }
            }
          }
        } catch (err) {
          console.error("Identity Sync Failed:", err);
          hasSyncedIdentity.current = false;
        }
      }

      // ⚡️ BACKGROUND DATA SYNC
      if (!user.referralCode) {
        try {
          const res = await apiFetch(`/users/me?fingerprint=${user.deviceId}`);
          if (res.ok) {
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

            // 🛡️ Check security after sync
            if (updatedUser.securityLevel < 2) {
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
        setUser: updateUserData,
        loading,
        pinModalVisible,    // Expose this
        setPinModalVisible  // Expose this
      }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);